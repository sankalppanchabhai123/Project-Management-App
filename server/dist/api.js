"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRouter = void 0;
const client_1 = require("@prisma/client");
const express_1 = require("express");
const zod_1 = require("zod");
const user_js_1 = require("./auth/user.js");
const prisma_js_1 = require("./lib/prisma.js");
const http_js_1 = require("./lib/http.js");
const authenticateJWT_js_1 = require("./middleware/authenticateJWT.js");
const realtime_js_1 = require("./realtime.js");
const apiRouter = (0, express_1.Router)();
exports.apiRouter = apiRouter;
const hexColorSchema = zod_1.z.string().regex(/^#([0-9a-fA-F]{6})$/, 'Must be a valid hex color');
const projectCreateSchema = zod_1.z.object({
    title: zod_1.z.string().min(1),
    description: zod_1.z.string().trim().optional().nullable(),
    color: hexColorSchema,
});
const projectUpdateSchema = projectCreateSchema.partial().extend({
    title: zod_1.z.string().min(1).optional(),
    description: zod_1.z.string().trim().optional().nullable(),
    color: hexColorSchema.optional(),
});
const inviteMemberSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    role: zod_1.z.nativeEnum(client_1.ProjectMemberRole).optional().default(client_1.ProjectMemberRole.VIEWER),
});
const taskCreateSchema = zod_1.z.object({
    title: zod_1.z.string().min(1),
    description: zod_1.z.string().trim().optional().nullable(),
    priority: zod_1.z.nativeEnum(client_1.TaskPriority).optional().default(client_1.TaskPriority.MEDIUM),
    dueDate: zod_1.z.coerce.date().optional().nullable(),
    assigneeId: zod_1.z.string().uuid().optional().nullable(),
    status: zod_1.z.nativeEnum(client_1.TaskStatus).optional().default(client_1.TaskStatus.PENDING),
});
const taskUpdateSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).optional(),
    description: zod_1.z.string().trim().optional().nullable(),
    priority: zod_1.z.nativeEnum(client_1.TaskPriority).optional(),
    dueDate: zod_1.z.coerce.date().optional().nullable(),
    assigneeId: zod_1.z.string().uuid().optional().nullable(),
});
const taskMoveSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(client_1.TaskStatus),
    position: zod_1.z.number().int().nonnegative(),
});
function responsePayload(data, message = 'OK') {
    return { data, error: null, message };
}
function createHttpError(statusCode, message) {
    return new http_js_1.HttpError(statusCode, message);
}
function parseSchema(schema, input) {
    const result = schema.safeParse(input);
    if (!result.success) {
        throw createHttpError(400, result.error.issues.map((issue) => issue.message).join(', '));
    }
    return result.data;
}
function toProjectWhereForUser(userId, projectId) {
    return {
        ...(projectId ? { id: projectId } : {}),
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    };
}
async function getUserProject(projectId, userId) {
    const project = await prisma_js_1.prisma.project.findFirst({
        where: toProjectWhereForUser(userId, projectId),
        include: {
            owner: { select: user_js_1.safeUserSelect },
            members: {
                include: { user: { select: user_js_1.safeUserSelect } },
            },
            tags: true,
        },
    });
    if (!project) {
        throw createHttpError(404, 'Project not found');
    }
    return project;
}
async function requireProjectRole(projectId, userId) {
    const project = await prisma_js_1.prisma.project.findFirst({
        where: toProjectWhereForUser(userId, projectId),
        include: {
            members: { where: { userId } },
        },
    });
    if (!project) {
        throw createHttpError(404, 'Project not found');
    }
    const role = project.ownerId === userId ? client_1.ProjectMemberRole.OWNER : project.members[0]?.role;
    return { project, role };
}
function ensureManager(role) {
    if (role !== client_1.ProjectMemberRole.OWNER && role !== client_1.ProjectMemberRole.EDITOR) {
        throw createHttpError(403, 'Insufficient project permissions');
    }
}
function ensureOwner(role) {
    if (role !== client_1.ProjectMemberRole.OWNER) {
        throw createHttpError(403, 'Owner permissions required');
    }
}
function taskInclude() {
    return {
        assignee: { select: user_js_1.safeUserSelect },
        taskTags: {
            include: {
                tag: true,
            },
        },
    };
}
function groupTasksByStatus(tasks) {
    return {
        [client_1.TaskStatus.PENDING]: tasks.filter((task) => task.status === client_1.TaskStatus.PENDING),
        [client_1.TaskStatus.ONGOING]: tasks.filter((task) => task.status === client_1.TaskStatus.ONGOING),
        [client_1.TaskStatus.COMPLETED]: tasks.filter((task) => task.status === client_1.TaskStatus.COMPLETED),
    };
}
function getTaskNextPosition(tasks) {
    return tasks.reduce((max, task) => Math.max(max, task.position), 0) + 1;
}
apiRouter.use(authenticateJWT_js_1.authenticateJWT);
apiRouter.get('/projects', async (request, response) => {
    const user = request.user;
    const projects = await prisma_js_1.prisma.project.findMany({
        where: {
            OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
        },
        include: {
            owner: { select: user_js_1.safeUserSelect },
            members: { where: { userId: user.id } },
            _count: { select: { tasks: true, members: true } },
        },
        orderBy: { updatedAt: 'desc' },
    });
    response.json(responsePayload({ projects }));
});
apiRouter.post('/projects', async (request, response) => {
    const user = request.user;
    const body = parseSchema(projectCreateSchema, request.body);
    const project = await prisma_js_1.prisma.$transaction(async (transaction) => {
        const createdProject = await transaction.project.create({
            data: {
                title: body.title,
                description: body.description ?? null,
                color: body.color,
                ownerId: user.id,
            },
            include: {
                owner: { select: user_js_1.safeUserSelect },
            },
        });
        await transaction.projectMember.create({
            data: {
                projectId: createdProject.id,
                userId: user.id,
                role: client_1.ProjectMemberRole.OWNER,
            },
        });
        return createdProject;
    });
    response.status(201).json(responsePayload({ project }, 'Project created'));
});
apiRouter.get('/projects/:id', async (request, response) => {
    const project = await getUserProject(request.params.id, request.user.id);
    const tasks = await prisma_js_1.prisma.task.findMany({
        where: { projectId: project.id },
        include: taskInclude(),
        orderBy: [{ status: 'asc' }, { position: 'asc' }],
    });
    response.json(responsePayload({ project, tasks, tasksByStatus: groupTasksByStatus(tasks) }));
});
apiRouter.put('/projects/:id', async (request, response) => {
    const { project, role } = await requireProjectRole(request.params.id, request.user.id);
    ensureManager(role);
    const body = parseSchema(projectUpdateSchema, request.body);
    const updatedProject = await prisma_js_1.prisma.project.update({
        where: { id: project.id },
        data: {
            ...(body.title !== undefined ? { title: body.title } : {}),
            ...(body.description !== undefined ? { description: body.description } : {}),
            ...(body.color !== undefined ? { color: body.color } : {}),
        },
        include: {
            owner: { select: user_js_1.safeUserSelect },
            members: true,
        },
    });
    response.json(responsePayload({ project: updatedProject }, 'Project updated'));
});
apiRouter.delete('/projects/:id', async (request, response) => {
    const { project, role } = await requireProjectRole(request.params.id, request.user.id);
    ensureOwner(role);
    await prisma_js_1.prisma.project.delete({ where: { id: project.id } });
    response.json(responsePayload({ projectId: project.id }, 'Project deleted'));
});
apiRouter.post('/projects/:id/members', async (request, response) => {
    const { project, role } = await requireProjectRole(request.params.id, request.user.id);
    ensureManager(role);
    const body = parseSchema(inviteMemberSchema, request.body);
    const memberUser = await prisma_js_1.prisma.user.findUnique({ where: { email: body.email }, select: user_js_1.safeUserSelect });
    if (!memberUser) {
        throw createHttpError(404, 'User with that email was not found');
    }
    const membership = await prisma_js_1.prisma.projectMember.upsert({
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
            role: body.role ?? client_1.ProjectMemberRole.VIEWER,
        },
        include: { user: { select: user_js_1.safeUserSelect } },
    });
    response.status(201).json(responsePayload({ member: membership }, 'Member added'));
});
apiRouter.get('/projects/:id/tasks', async (request, response) => {
    const project = await getUserProject(request.params.id, request.user.id);
    const tasks = await prisma_js_1.prisma.task.findMany({
        where: { projectId: project.id },
        include: taskInclude(),
        orderBy: [{ status: 'asc' }, { position: 'asc' }],
    });
    response.json(responsePayload({ tasks: groupTasksByStatus(tasks) }));
});
apiRouter.post('/projects/:id/tasks', async (request, response) => {
    const project = await getUserProject(request.params.id, request.user.id);
    const body = parseSchema(taskCreateSchema, request.body);
    const sameStatusTasks = await prisma_js_1.prisma.task.findMany({
        where: { projectId: project.id, status: body.status },
        select: { position: true },
    });
    const task = await prisma_js_1.prisma.task.create({
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
    (0, realtime_js_1.emitTaskCreated)(project.id, task);
    response.status(201).json(responsePayload({ task }, 'Task created'));
});
apiRouter.put('/tasks/:id', async (request, response) => {
    const body = parseSchema(taskUpdateSchema, request.body);
    const existingTask = await prisma_js_1.prisma.task.findUnique({
        where: { id: request.params.id },
        include: { project: true, assignee: { select: user_js_1.safeUserSelect } },
    });
    if (!existingTask) {
        throw createHttpError(404, 'Task not found');
    }
    await getUserProject(existingTask.projectId, request.user.id);
    const updatedTask = await prisma_js_1.prisma.task.update({
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
    (0, realtime_js_1.emitTaskUpdated)(updatedTask.projectId, updatedTask);
    response.json(responsePayload({ task: updatedTask }, 'Task updated'));
});
apiRouter.patch('/tasks/:id/move', async (request, response) => {
    const body = parseSchema(taskMoveSchema, request.body);
    const existingTask = await prisma_js_1.prisma.task.findUnique({
        where: { id: request.params.id },
        select: { id: true, projectId: true, status: true, position: true },
    });
    if (!existingTask) {
        throw createHttpError(404, 'Task not found');
    }
    await getUserProject(existingTask.projectId, request.user.id);
    const updatedTask = await prisma_js_1.prisma.task.update({
        where: { id: existingTask.id },
        data: {
            status: body.status,
            position: body.position,
        },
        include: taskInclude(),
    });
    (0, realtime_js_1.emitTaskMoved)(updatedTask.projectId, updatedTask.id, body.status, body.position);
    (0, realtime_js_1.emitTaskUpdated)(updatedTask.projectId, updatedTask);
    response.json(responsePayload({ task: updatedTask }, 'Task moved'));
});
apiRouter.delete('/tasks/:id', async (request, response) => {
    const existingTask = await prisma_js_1.prisma.task.findUnique({
        where: { id: request.params.id },
        select: { id: true, projectId: true },
    });
    if (!existingTask) {
        throw createHttpError(404, 'Task not found');
    }
    await getUserProject(existingTask.projectId, request.user.id);
    await prisma_js_1.prisma.task.delete({ where: { id: existingTask.id } });
    (0, realtime_js_1.emitTaskDeleted)(existingTask.projectId, existingTask.id);
    response.json(responsePayload({ taskId: existingTask.id }, 'Task deleted'));
});
apiRouter.patch('/tasks/:id/timer/start', async (request, response) => {
    const existingTask = await prisma_js_1.prisma.task.findUnique({
        where: { id: request.params.id },
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
    await getUserProject(existingTask.projectId, request.user.id);
    if (existingTask.timerRunning) {
        throw createHttpError(409, 'Task timer is already running');
    }
    const task = await (0, realtime_js_1.startTaskTimer)(existingTask);
    (0, realtime_js_1.emitTaskUpdated)(task.projectId, task);
    response.json(responsePayload({ task }, 'Timer started'));
});
apiRouter.patch('/tasks/:id/timer/stop', async (request, response) => {
    const existingTask = await prisma_js_1.prisma.task.findUnique({
        where: { id: request.params.id },
        select: { id: true, projectId: true },
    });
    if (!existingTask) {
        throw createHttpError(404, 'Task not found');
    }
    await getUserProject(existingTask.projectId, request.user.id);
    const task = await (0, realtime_js_1.stopTaskTimer)(existingTask.id);
    if (!task) {
        throw createHttpError(409, 'Task timer is not running');
    }
    response.json(responsePayload({ task }, 'Timer stopped'));
});
