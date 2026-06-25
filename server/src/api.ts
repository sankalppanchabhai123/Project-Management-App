import { ProjectMemberRole, Prisma, TaskPriority, TaskStatus } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { safeUserSelect } from './auth/user.js';
import { prisma } from './lib/prisma.js';
import { HttpError } from './lib/http.js';
import { authenticateJWT } from './middleware/authenticateJWT.js';
import {
    emitTaskCreated,
    emitTaskDeleted,
    emitTaskMoved,
    emitTaskUpdated,
    startTaskTimer,
    stopTaskTimer,
} from './realtime.js';

const apiRouter = Router();

const hexColorSchema = z.string().regex(/^#([0-9a-fA-F]{6})$/, 'Must be a valid hex color');

const projectCreateSchema = z.object({
    title: z.string().min(1),
    description: z.string().trim().optional().nullable(),
    color: hexColorSchema,
});

const projectUpdateSchema = projectCreateSchema.partial().extend({
    title: z.string().min(1).optional(),
    description: z.string().trim().optional().nullable(),
    color: hexColorSchema.optional(),
});

const inviteMemberSchema = z.object({
    email: z.string().email(),
    role: z.nativeEnum(ProjectMemberRole).optional().default(ProjectMemberRole.VIEWER),
});

const taskCreateSchema = z.object({
    title: z.string().min(1),
    description: z.string().trim().optional().nullable(),
    priority: z.nativeEnum(TaskPriority).optional().default(TaskPriority.MEDIUM),
    dueDate: z.coerce.date().optional().nullable(),
    assigneeId: z.string().uuid().optional().nullable(),
    status: z.nativeEnum(TaskStatus).optional().default(TaskStatus.PENDING),
});

const taskUpdateSchema = z.object({
    title: z.string().min(1).optional(),
    description: z.string().trim().optional().nullable(),
    priority: z.nativeEnum(TaskPriority).optional(),
    dueDate: z.coerce.date().optional().nullable(),
    assigneeId: z.string().uuid().optional().nullable(),
});

const taskMoveSchema = z.object({
    status: z.nativeEnum(TaskStatus),
    position: z.number().int().nonnegative(),
});

type AuthenticatedRequest = Parameters<typeof authenticateJWT>[0];

function responsePayload<T>(data: T, message = 'OK') {
    return { data, error: null, message };
}

function createHttpError(statusCode: number, message: string) {
    return new HttpError(statusCode, message);
}

function getSocketId(request: AuthenticatedRequest) {
    const socketId = request.get('x-socket-id');
    return socketId?.trim() ? socketId : undefined;
}

function parseSchema<T>(schema: z.ZodType<T>, input: unknown): T {
    const result = schema.safeParse(input);
    if (!result.success) {
        throw createHttpError(400, result.error.issues.map((issue) => issue.message).join(', '));
    }

    return result.data;
}

function toProjectWhereForUser(userId: string, projectId?: string) {
    return {
        ...(projectId ? { id: projectId } : {}),
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    } satisfies Prisma.ProjectWhereInput;
}

async function getUserProject(projectId: string, userId: string) {
    const project = await prisma.project.findFirst({
        where: toProjectWhereForUser(userId, projectId),
        include: {
            owner: { select: safeUserSelect },
            members: {
                include: { user: { select: safeUserSelect } },
            },
            tags: true,
        },
    });

    if (!project) {
        throw createHttpError(404, 'Project not found');
    }

    return project;
}

async function requireProjectRole(projectId: string, userId: string) {
    const project = await prisma.project.findFirst({
        where: toProjectWhereForUser(userId, projectId),
        include: {
            members: { where: { userId } },
        },
    });

    if (!project) {
        throw createHttpError(404, 'Project not found');
    }

    const role = project.ownerId === userId ? ProjectMemberRole.OWNER : project.members[0]?.role;
    return { project, role };
}

function ensureManager(role?: ProjectMemberRole) {
    if (role !== ProjectMemberRole.OWNER && role !== ProjectMemberRole.EDITOR) {
        throw createHttpError(403, 'Insufficient project permissions');
    }
}

function ensureOwner(role?: ProjectMemberRole) {
    if (role !== ProjectMemberRole.OWNER) {
        throw createHttpError(403, 'Owner permissions required');
    }
}

function taskInclude() {
    return {
        assignee: { select: safeUserSelect },
        taskTags: {
            include: {
                tag: true,
            },
        },
    } as const;
}

function groupTasksByStatus(tasks: Array<Awaited<ReturnType<typeof prisma.task.findMany>>[number]>) {
    return {
        [TaskStatus.PENDING]: tasks.filter((task) => task.status === TaskStatus.PENDING),
        [TaskStatus.ONGOING]: tasks.filter((task) => task.status === TaskStatus.ONGOING),
        [TaskStatus.COMPLETED]: tasks.filter((task) => task.status === TaskStatus.COMPLETED),
    };
}

function getTaskNextPosition(tasks: Array<{ position: number }>) {
    return tasks.reduce((max, task) => Math.max(max, task.position), 0) + 1;
}

apiRouter.use(authenticateJWT);

apiRouter.get(
    '/projects',
    async (request: AuthenticatedRequest, response) => {
        const user = request.user!;

        const projects = await prisma.project.findMany({
            where: {
                OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
            },
            include: {
                owner: { select: safeUserSelect },
                members: { where: { userId: user.id } },
                _count: { select: { tasks: true, members: true } },
            },
            orderBy: { updatedAt: 'desc' },
        });

        response.json(responsePayload({ projects }));
    }
);

apiRouter.post(
    '/projects',
    async (request: AuthenticatedRequest, response) => {
        const user = request.user!;
        const body = parseSchema(projectCreateSchema, request.body);

        const project = await prisma.$transaction(async (transaction) => {
            const createdProject = await transaction.project.create({
                data: {
                    title: body.title,
                    description: body.description ?? null,
                    color: body.color,
                    ownerId: user.id,
                },
                include: {
                    owner: { select: safeUserSelect },
                },
            });

            await transaction.projectMember.create({
                data: {
                    projectId: createdProject.id,
                    userId: user.id,
                    role: ProjectMemberRole.OWNER,
                },
            });

            return createdProject;
        });

        response.status(201).json(responsePayload({ project }, 'Project created'));
    }
);

apiRouter.get(
    '/projects/:id',
    async (request: AuthenticatedRequest, response) => {
        const project = await getUserProject(request.params.id as string, request.user!.id);
        const tasks = await prisma.task.findMany({
            where: { projectId: project.id },
            include: taskInclude(),
            orderBy: [{ status: 'asc' }, { position: 'asc' }],
        });

        response.json(responsePayload({ project, tasks, tasksByStatus: groupTasksByStatus(tasks) }));
    }
);

apiRouter.put(
    '/projects/:id',
    async (request: AuthenticatedRequest, response) => {
        const { project, role } = await requireProjectRole(request.params.id as string, request.user!.id);
        ensureManager(role);

        const body = parseSchema(projectUpdateSchema, request.body);

        const updatedProject = await prisma.project.update({
            where: { id: project.id },
            data: {
                ...(body.title !== undefined ? { title: body.title } : {}),
                ...(body.description !== undefined ? { description: body.description } : {}),
                ...(body.color !== undefined ? { color: body.color } : {}),
            },
            include: {
                owner: { select: safeUserSelect },
                members: true,
            },
        });

        response.json(responsePayload({ project: updatedProject }, 'Project updated'));
    }
);

apiRouter.delete(
    '/projects/:id',
    async (request: AuthenticatedRequest, response) => {
        const { project, role } = await requireProjectRole(request.params.id as string, request.user!.id);
        ensureOwner(role);

        await prisma.project.delete({ where: { id: project.id } });

        response.json(responsePayload({ projectId: project.id }, 'Project deleted'));
    }
);

apiRouter.post(
    '/projects/:id/members',
    async (request: AuthenticatedRequest, response) => {
        const { project, role } = await requireProjectRole(request.params.id as string, request.user!.id);
        ensureManager(role);

        const body = parseSchema(inviteMemberSchema, request.body);
        const memberUser = await prisma.user.findUnique({ where: { email: body.email }, select: safeUserSelect });

        if (!memberUser) {
            throw createHttpError(404, 'User with that email was not found');
        }

        const membership = await prisma.projectMember.upsert({
            where: {
                projectId_userId: {
                    projectId: project.id,
                    userId: memberUser.id,
                },
            },
            update: { role: body.role },
            create: {
                projectId: project.id,
                userId: memberUser.id,
                role: body.role ?? ProjectMemberRole.VIEWER,
            },
            include: { user: { select: safeUserSelect } },
        });

        response.status(201).json(responsePayload({ member: membership }, 'Member added'));
    }
);

apiRouter.get(
    '/projects/:id/tasks',
    async (request: AuthenticatedRequest, response) => {
        const project = await getUserProject(request.params.id as string, request.user!.id);
        const tasks = await prisma.task.findMany({
            where: { projectId: project.id },
            include: taskInclude(),
            orderBy: [{ status: 'asc' }, { position: 'asc' }],
        });

        response.json(responsePayload({ tasks: groupTasksByStatus(tasks) }));
    }
);

apiRouter.post(
    '/projects/:id/tasks',
    async (request: AuthenticatedRequest, response) => {
        const project = await getUserProject(request.params.id as string, request.user!.id);
        const body = parseSchema(taskCreateSchema, request.body);

        const sameStatusTasks = await prisma.task.findMany({
            where: { projectId: project.id, status: body.status },
            select: { position: true },
        });

        const task = await prisma.task.create({
            data: {
                title: body.title,
                description: body.description ?? null,
                priority: body.priority,
                dueDate: body.dueDate ?? null,
                projectId: project.id,
                assigneeId: body.assigneeId ?? null,
                status: body.status,
                position: getTaskNextPosition(sameStatusTasks),
            },
            include: taskInclude(),
        });

        emitTaskCreated(project.id, task, getSocketId(request));
        response.status(201).json(responsePayload({ task }, 'Task created'));
    }
);

apiRouter.put(
    '/tasks/:id',
    async (request: AuthenticatedRequest, response) => {
        const body = parseSchema(taskUpdateSchema, request.body);

        const existingTask = await prisma.task.findUnique({
            where: { id: request.params.id as string },
            include: { project: true, assignee: { select: safeUserSelect } },
        });

        if (!existingTask) {
            throw createHttpError(404, 'Task not found');
        }

        await getUserProject(existingTask.projectId, request.user!.id);

        const updatedTask = await prisma.task.update({
            where: { id: existingTask.id },
            data: {
                ...(body.title !== undefined ? { title: body.title } : {}),
                ...(body.description !== undefined ? { description: body.description } : {}),
                ...(body.priority !== undefined ? { priority: body.priority } : {}),
                ...(body.dueDate !== undefined ? { dueDate: body.dueDate } : {}),
                ...(body.assigneeId !== undefined ? { assigneeId: body.assigneeId } : {}),
            },
            include: taskInclude(),
        });

        emitTaskUpdated(updatedTask.projectId, updatedTask, getSocketId(request));
        response.json(responsePayload({ task: updatedTask }, 'Task updated'));
    }
);

apiRouter.patch(
    '/tasks/:id/move',
    async (request: AuthenticatedRequest, response) => {
        const body = parseSchema(taskMoveSchema, request.body);

        const existingTask = await prisma.task.findUnique({
            where: { id: request.params.id as string },
            select: { id: true, projectId: true, status: true, position: true },
        });

        if (!existingTask) {
            throw createHttpError(404, 'Task not found');
        }

        await getUserProject(existingTask.projectId, request.user!.id);

        const updatedTask = await prisma.task.update({
            where: { id: existingTask.id },
            data: {
                status: body.status,
                position: body.position,
            },
            include: taskInclude(),
        });

        emitTaskMoved(updatedTask.projectId, updatedTask.id, body.status, body.position, getSocketId(request));
        emitTaskUpdated(updatedTask.projectId, updatedTask, getSocketId(request));
        response.json(responsePayload({ task: updatedTask }, 'Task moved'));
    }
);

apiRouter.delete(
    '/tasks/:id',
    async (request: AuthenticatedRequest, response) => {
        const existingTask = await prisma.task.findUnique({
            where: { id: request.params.id as string },
            select: { id: true, projectId: true },
        });

        if (!existingTask) {
            throw createHttpError(404, 'Task not found');
        }

        await getUserProject(existingTask.projectId, request.user!.id);
        await prisma.task.delete({ where: { id: existingTask.id } });
        emitTaskDeleted(existingTask.projectId, existingTask.id, getSocketId(request));

        response.json(responsePayload({ taskId: existingTask.id }, 'Task deleted'));
    }
);

apiRouter.patch(
    '/tasks/:id/timer/start',
    async (request: AuthenticatedRequest, response) => {
        const existingTask = await prisma.task.findUnique({
            where: { id: request.params.id as string },
            select: {
                id: true,
                projectId: true,
                timerSeconds: true,
                timerRunning: true,
                startedAt: true,
            },
        });

        if (!existingTask) {
            throw createHttpError(404, 'Task not found');
        }

        await getUserProject(existingTask.projectId, request.user!.id);

        if (existingTask.timerRunning) {
            throw createHttpError(409, 'Task timer is already running');
        }

        const task = await startTaskTimer(existingTask);
        emitTaskUpdated(task.projectId, task, getSocketId(request));

        response.json(responsePayload({ task }, 'Timer started'));
    }
);

apiRouter.patch(
    '/tasks/:id/timer/stop',
    async (request: AuthenticatedRequest, response) => {
        const existingTask = await prisma.task.findUnique({
            where: { id: request.params.id as string },
            select: { id: true, projectId: true },
        });

        if (!existingTask) {
            throw createHttpError(404, 'Task not found');
        }

        await getUserProject(existingTask.projectId, request.user!.id);

        const task = await stopTaskTimer(existingTask.id);

        if (!task) {
            throw createHttpError(409, 'Task timer is not running');
        }

        emitTaskUpdated(task.projectId, task, getSocketId(request));

        response.json(responsePayload({ task }, 'Timer stopped'));
    }
);

export { apiRouter };