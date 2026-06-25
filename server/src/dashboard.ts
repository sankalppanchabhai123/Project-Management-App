import { Router } from 'express';
import { subDays, formatISO, isWithinInterval, startOfDay } from 'date-fns';
import { TaskPriority, TaskStatus } from '@prisma/client';

import { prisma } from './lib/prisma.js';
import { authenticateJWT } from './middleware/authenticateJWT.js';
import { safeUserSelect } from './auth/user.js';

const dashboardRouter = Router();

dashboardRouter.use(authenticateJWT);

dashboardRouter.get('/', async (request, response) => {
    const user = request.user!;
    const projects = await prisma.project.findMany({
        where: {
            OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
        },
        select: { id: true, title: true, color: true },
        orderBy: { updatedAt: 'desc' },
    });

    const projectIds = projects.map((project) => project.id);
    const tasks = await prisma.task.findMany({
        where: { projectId: { in: projectIds } },
        include: {
            assignee: { select: safeUserSelect },
            project: { select: { id: true, title: true, color: true } },
        },
        orderBy: { updatedAt: 'desc' },
    });

    const now = new Date();
    const weekStart = startOfDay(subDays(now, 6));
    const taskEvents = tasks
        .flatMap((task) => [
            {
                id: `${task.id}-created`,
                type: 'created' as const,
                taskId: task.id,
                title: task.title,
                projectId: task.projectId,
                projectTitle: task.project.title,
                user: task.assignee ?? { id: user.id, name: user.name, avatar: user.avatar ?? null },
                createdAt: task.createdAt,
            },
            ...(task.updatedAt > task.createdAt
                ? [
                      {
                          id: `${task.id}-updated`,
                          type: task.status === TaskStatus.COMPLETED ? ('completed' as const) : ('moved' as const),
                          taskId: task.id,
                          title: task.title,
                          projectId: task.projectId,
                          projectTitle: task.project.title,
                          user: task.assignee ?? { id: user.id, name: user.name, avatar: user.avatar ?? null },
                          createdAt: task.updatedAt,
                      },
                  ]
                : []),
        ])
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
        .slice(0, 10);

    const completedThisWeek = tasks.filter(
        (task) => task.status === TaskStatus.COMPLETED && isWithinInterval(task.updatedAt, { start: weekStart, end: now })
    ).length;

    const overdueTasks = tasks.filter((task) => task.dueDate && task.dueDate < now && task.status !== TaskStatus.COMPLETED).length;

    const statusCounts = {
        pending: tasks.filter((task) => task.status === TaskStatus.PENDING).length,
        ongoing: tasks.filter((task) => task.status === TaskStatus.ONGOING).length,
        completed: tasks.filter((task) => task.status === TaskStatus.COMPLETED).length,
    };

    const last7Days = Array.from({ length: 7 }, (_, index) => subDays(now, 6 - index));
    const completionTrend = last7Days.map((day) => {
        const nextDay = new Date(day);
        nextDay.setDate(nextDay.getDate() + 1);

        return {
            date: formatISO(day, { representation: 'date' }),
            completed: tasks.filter(
                (task) =>
                    task.status === TaskStatus.COMPLETED &&
                    task.updatedAt >= day &&
                    task.updatedAt < nextDay
            ).length,
        };
    });

    const priorityCounts = {
        low: tasks.filter((task) => task.priority === TaskPriority.LOW).length,
        medium: tasks.filter((task) => task.priority === TaskPriority.MEDIUM).length,
        high: tasks.filter((task) => task.priority === TaskPriority.HIGH).length,
        urgent: tasks.filter((task) => task.priority === TaskPriority.URGENT).length,
    };

    const myTasks = tasks
        .filter((task) => task.assigneeId === user.id)
        .map((task) => ({
            ...task,
            dueGroup:
                task.dueDate && task.dueDate <= now
                    ? 'Today'
                    : task.dueDate && isWithinInterval(task.dueDate, { start: now, end: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) })
                      ? 'This Week'
                      : 'Later',
        }));

    response.json({
        totalTasks: tasks.length,
        completedThisWeek,
        overdueTasks,
        statusDistribution: statusCounts,
        completionTrend,
        priorityBreakdown: priorityCounts,
        recentActivity: taskEvents,
        myTasks,
        projects,
    });
});

export { dashboardRouter };