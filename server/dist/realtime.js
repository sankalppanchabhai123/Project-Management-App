"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitTaskCreated = emitTaskCreated;
exports.emitTaskUpdated = emitTaskUpdated;
exports.emitTaskMoved = emitTaskMoved;
exports.emitTaskDeleted = emitTaskDeleted;
exports.restoreRunningTimers = restoreRunningTimers;
exports.initializeRealtime = initializeRealtime;
exports.startTaskTimer = startTaskTimer;
exports.stopTaskTimer = stopTaskTimer;
exports.getSocketServer = getSocketServer;
const socket_io_1 = require("socket.io");
const env_js_1 = require("./config/env.js");
const authenticateJWT_js_1 = require("./middleware/authenticateJWT.js");
const prisma_js_1 = require("./lib/prisma.js");
let io = null;
const runningTimers = new Map();
function projectRoom(projectId) {
    return `project:${projectId}`;
}
async function canAccessProject(userId, projectId) {
    const project = await prisma_js_1.prisma.project.findFirst({
        where: {
            id: projectId,
            OR: [{ ownerId: userId }, { members: { some: { userId } } }],
        },
        select: { id: true },
    });
    return Boolean(project);
}
function emitToProject(projectId, event, payload) {
    io?.to(projectRoom(projectId)).emit(event, payload);
}
function emitTimerTick(state) {
    const elapsedSeconds = Math.floor((Date.now() - state.startedAt.getTime()) / 1000);
    emitToProject(state.projectId, 'timer:tick', {
        taskId: state.taskId,
        projectId: state.projectId,
        timerSeconds: state.baseSeconds + elapsedSeconds,
        startedAt: state.startedAt.toISOString(),
    });
}
function clearTimer(taskId) {
    const state = runningTimers.get(taskId);
    if (!state) {
        return;
    }
    clearInterval(state.intervalId);
    runningTimers.delete(taskId);
}
function startTimerTaskState(task) {
    clearTimer(task.id);
    if (!task.startedAt) {
        return;
    }
    const state = {
        taskId: task.id,
        projectId: task.projectId,
        startedAt: task.startedAt,
        baseSeconds: task.timerSeconds,
        intervalId: setInterval(() => {
            emitTimerTick(state);
        }, 1000),
    };
    runningTimers.set(task.id, state);
    emitTimerTick(state);
}
function emitTaskCreated(projectId, task) {
    emitToProject(projectId, 'task:created', { task });
}
function emitTaskUpdated(projectId, task) {
    emitToProject(projectId, 'task:updated', { task });
}
function emitTaskMoved(projectId, taskId, status, position) {
    emitToProject(projectId, 'task:moved', { taskId, status, position });
}
function emitTaskDeleted(projectId, taskId) {
    emitToProject(projectId, 'task:deleted', { taskId });
}
async function restoreRunningTimers() {
    const tasks = await prisma_js_1.prisma.task.findMany({
        where: {
            timerRunning: true,
            startedAt: { not: null },
        },
        select: {
            id: true,
            projectId: true,
            timerSeconds: true,
            startedAt: true,
        },
    });
    tasks.forEach((task) => {
        startTimerTaskState(task);
    });
}
function initializeRealtime(server) {
    if (io) {
        return io;
    }
    io = new socket_io_1.Server(server, {
        cors: {
            origin: env_js_1.env.CLIENT_URL,
            credentials: true,
        },
    });
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            if (typeof token !== 'string' || token.trim().length === 0) {
                next(new Error('Unauthorized'));
                return;
            }
            const user = await (0, authenticateJWT_js_1.getUserFromAccessToken)(token);
            socket.data.user = user;
            next();
        }
        catch {
            next(new Error('Unauthorized'));
        }
    });
    io.on('connection', (socket) => {
        socket.emit('connected', { ok: true });
        socket.on('project:join', async (projectId, ack) => {
            try {
                const user = socket.data.user;
                if (!user) {
                    ack?.({ ok: false, error: 'Unauthorized' });
                    return;
                }
                const allowed = await canAccessProject(user.id, projectId);
                if (!allowed) {
                    ack?.({ ok: false, error: 'Forbidden' });
                    return;
                }
                socket.join(projectRoom(projectId));
                ack?.({ ok: true });
            }
            catch {
                ack?.({ ok: false, error: 'Unable to join project room' });
            }
        });
        socket.on('project:leave', (projectId) => {
            socket.leave(projectRoom(projectId));
        });
    });
    return io;
}
async function startTaskTimer(task) {
    const updated = await prisma_js_1.prisma.task.update({
        where: { id: task.id },
        data: {
            timerRunning: true,
            startedAt: task.startedAt ?? new Date(),
        },
        select: {
            id: true,
            projectId: true,
            timerSeconds: true,
            startedAt: true,
        },
    });
    startTimerTaskState(updated);
    return updated;
}
async function stopTaskTimer(taskId) {
    const task = await prisma_js_1.prisma.task.findUnique({
        where: { id: taskId },
        select: {
            id: true,
            projectId: true,
            timerSeconds: true,
            startedAt: true,
            timerRunning: true,
        },
    });
    if (!task || !task.timerRunning || !task.startedAt) {
        return null;
    }
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - task.startedAt.getTime()) / 1000));
    const updated = await prisma_js_1.prisma.task.update({
        where: { id: task.id },
        data: {
            timerRunning: false,
            startedAt: null,
            timerSeconds: task.timerSeconds + elapsedSeconds,
        },
        select: {
            id: true,
            projectId: true,
            timerSeconds: true,
            startedAt: true,
            timerRunning: true,
        },
    });
    clearTimer(task.id);
    emitTaskUpdated(updated.projectId, updated);
    return updated;
}
function getSocketServer() {
    return io;
}
