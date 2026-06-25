import { PrismaClient, Provider, ProjectMemberRole, TaskPriority, TaskStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    await prisma.taskTag.deleteMany();
    await prisma.tag.deleteMany();
    await prisma.task.deleteMany();
    await prisma.projectMember.deleteMany();
    await prisma.project.deleteMany();
    await prisma.user.deleteMany();

    const passwordHash = await bcrypt.hash('password123', 10);

    const demoUsers = await Promise.all([
        prisma.user.create({
            data: {
                email: 'admin@taskflow.app',
                name: 'Avery Stone',
                avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Avery',
                provider: Provider.LOCAL,
                passwordHash,
            },
        }),
        prisma.user.create({
            data: {
                email: 'maria@taskflow.app',
                name: 'Maria Chen',
                avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Maria',
                provider: Provider.GOOGLE,
                providerId: 'google-maria-001',
            },
        }),
    ]);

    const [owner, collaborator] = demoUsers;

    const project = await prisma.project.create({
        data: {
            title: 'Website Redesign',
            description: 'Refresh the marketing site and ship a new project dashboard.',
            color: '#0f766e',
            ownerId: owner.id,
        },
    });

    await prisma.projectMember.createMany({
        data: [
            { projectId: project.id, userId: owner.id, role: ProjectMemberRole.OWNER },
            { projectId: project.id, userId: collaborator.id, role: ProjectMemberRole.EDITOR },
        ],
    });

    const tags = await Promise.all([
        prisma.tag.create({
            data: {
                name: 'Design',
                color: '#06b6d4',
                projectId: project.id,
            },
        }),
        prisma.tag.create({
            data: {
                name: 'Frontend',
                color: '#f59e0b',
                projectId: project.id,
            },
        }),
    ]);

    const tasks = await Promise.all([
        prisma.task.create({
            data: {
                title: 'Finalize homepage wireframes',
                description: 'Confirm the new hero section and navigation structure.',
                status: TaskStatus.PENDING,
                priority: TaskPriority.HIGH,
                projectId: project.id,
                assigneeId: owner.id,
                position: 1,
            },
        }),
        prisma.task.create({
            data: {
                title: 'Set up design tokens',
                description: 'Define spacing, typography, and color primitives.',
                status: TaskStatus.PENDING,
                priority: TaskPriority.MEDIUM,
                projectId: project.id,
                assigneeId: collaborator.id,
                position: 2,
            },
        }),
        prisma.task.create({
            data: {
                title: 'Build project summary cards',
                description: 'Implement the dashboard cards and responsive grid.',
                status: TaskStatus.ONGOING,
                priority: TaskPriority.HIGH,
                projectId: project.id,
                assigneeId: owner.id,
                position: 1,
                timerSeconds: 2_400,
                timerRunning: true,
            },
        }),
        prisma.task.create({
            data: {
                title: 'Connect task filters',
                description: 'Wire status and priority filters to the API.',
                status: TaskStatus.ONGOING,
                priority: TaskPriority.URGENT,
                projectId: project.id,
                assigneeId: collaborator.id,
                position: 2,
                timerSeconds: 1_800,
            },
        }),
        prisma.task.create({
            data: {
                title: 'Review responsive spacing',
                description: 'Check the layout at tablet and mobile breakpoints.',
                status: TaskStatus.COMPLETED,
                priority: TaskPriority.LOW,
                projectId: project.id,
                assigneeId: owner.id,
                position: 1,
            },
        }),
        prisma.task.create({
            data: {
                title: 'Polish empty states',
                description: 'Finalize copy and visuals for empty board sections.',
                status: TaskStatus.COMPLETED,
                priority: TaskPriority.MEDIUM,
                projectId: project.id,
                assigneeId: collaborator.id,
                position: 2,
            },
        }),
    ]);

    await prisma.taskTag.createMany({
        data: [
            { taskId: tasks[0].id, tagId: tags[0].id },
            { taskId: tasks[1].id, tagId: tags[0].id },
            { taskId: tasks[2].id, tagId: tags[1].id },
            { taskId: tasks[3].id, tagId: tags[1].id },
            { taskId: tasks[4].id, tagId: tags[0].id },
            { taskId: tasks[5].id, tagId: tags[1].id },
        ],
    });

    console.log('Seeded demo data for Taskflow.');
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });