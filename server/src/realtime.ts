import { Prisma, TaskStatus } from '@prisma/client';
import type { Socket } from 'socket.io';
import { Server } from 'socket.io';

import { env } from './config/env.js';
import { getUserFromAccessToken } from './middleware/authenticateJWT.js';
import { prisma } from './lib/prisma.js';
import type { SafeUser } from './auth/user.js';

type TimerState = {
    taskId: string;
    projectId: string;
    startedAt: Date;
    baseSeconds: number;
    intervalId: NodeJS.Timeout;
};

type ProjectScopedPayload = Record<string, unknown>;

let io: Server | null = null;
const runningTimers = new Map<string, TimerState>();
const projectPresence = new Map<string, Map<string, SafeUser>>();

function projectRoom(projectId: string) {
    return `project:${projectId}`;
}

async function canAccessProject(userId: string, projectId: string) {
    const project = await prisma.project.findFirst({
        where: {
            id: projectId,
            OR: [{ ownerId: userId }, { members: { some: { userId } } }],
        },
        select: { id: true },
    });

    return Boolean(project);
}

function emitToProject(projectId: string, event: string, payload: ProjectScopedPayload) {
    io?.to(projectRoom(projectId)).emit(event, payload);
}

function emitToProjectExcept(projectId: string, socketId: string | undefined, event: string, payload: ProjectScopedPayload) {
    const room = io?.to(projectRoom(projectId));

    if (!room) {
        return;
    }

    if (socketId) {
        room.except(socketId).emit(event, payload);
        return;
    }

    room.emit(event, payload);
}

function getPresence(projectId: string) {
    return Array.from(projectPresence.get(projectId)?.entries() ?? []).map(([socketId, user]) => ({
        socketId,
        id: user.id,
        name: user.name,
        avatarUrl: user.avatarUrl,
    }));
}

function addPresence(projectId: string, socketId: string, user: SafeUser) {
    const projectUsers = projectPresence.get(projectId) ?? new Map<string, SafeUser>();
    projectUsers.set(socketId, user);
    projectPresence.set(projectId, projectUsers);
}

function removePresence(projectId: string, socketId: string) {
    const projectUsers = projectPresence.get(projectId);

    if (!projectUsers) {
        return;
    }

    projectUsers.delete(socketId);

    if (projectUsers.size === 0) {
        projectPresence.delete(projectId);
    }
}

function emitTimerTick(state: TimerState) {
    const elapsedSeconds = Math.floor((Date.now() - state.startedAt.getTime()) / 1000);
    emitToProject(state.projectId, 'timer:tick', {
        taskId: state.taskId,
        projectId: state.projectId,
        timerSeconds: state.baseSeconds + elapsedSeconds,
        startedAt: state.startedAt.toISOString(),
    });
}

function clearTimer(taskId: string) {
    const state = runningTimers.get(taskId);
    if (!state) {
        return;
    }

    clearInterval(state.intervalId);
    runningTimers.delete(taskId);
}

function startTimerTaskState(task: { id: string; projectId: string; timerSeconds: number; startedAt: Date | null }) {
    clearTimer(task.id);

    if (!task.startedAt) {
        return;
    }

    const state: TimerState = {
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

export function emitTaskCreated(projectId: string, task: unknown, excludeSocketId?: string) {
    emitToProjectExcept(projectId, excludeSocketId, 'task:created', { task });
}

export function emitTaskUpdated(projectId: string, task: unknown, excludeSocketId?: string) {
    emitToProjectExcept(projectId, excludeSocketId, 'task:updated', { task });
}

export function emitTaskMoved(projectId: string, taskId: string, status: TaskStatus, position: number, excludeSocketId?: string) {
    emitToProjectExcept(projectId, excludeSocketId, 'task:moved', { taskId, status, position });
}

export function emitTaskDeleted(projectId: string, taskId: string, excludeSocketId?: string) {
    emitToProjectExcept(projectId, excludeSocketId, 'task:deleted', { taskId });
}

export async function restoreRunningTimers() {
    const tasks = await prisma.task.findMany({
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

export function initializeRealtime(server: HttpServer) {
    if (io) {
        return io;
    }

    io = new Server(server, {
        cors: {
            origin: env.CLIENT_URL,
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

            const user = await getUserFromAccessToken(token);
            socket.data.user = user;
            next();
        } catch {
            next(new Error('Unauthorized'));
        }
    });

    io.on('connection', (socket: Socket) => {
        socket.emit('connected', { ok: true });
        socket.data.joinedProjects ??= new Set<string>();

        const joinProject = async (projectId: string, ack?: (result: { ok: boolean; error?: string }) => void) => {
            try {
                const user = socket.data.user as SafeUser | undefined;

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
                socket.data.joinedProjects.add(projectId);
                addPresence(projectId, socket.id, user);
                socket.emit('presence:state', { projectId, users: getPresence(projectId) });
                socket.to(projectRoom(projectId)).emit('user:joined', { projectId, user });
                ack?.({ ok: true });
            } catch {
                ack?.({ ok: false, error: 'Unable to join project room' });
            }
        };

        const leaveProject = (projectId: string) => {
            socket.leave(projectRoom(projectId));
            removePresence(projectId, socket.id);
            socket.emit('presence:state', { projectId, users: getPresence(projectId) });
            socket.to(projectRoom(projectId)).emit('user:left', { projectId, socketId: socket.id });
            socket.data.joinedProjects.delete(projectId);
        };

        socket.on('project:join', joinProject);
        socket.on('join-project', joinProject);
        socket.on('project:leave', leaveProject);
        socket.on('leave-project', leaveProject);

        socket.on('task:moved', (payload: { projectId: string; taskId: string; status: TaskStatus; position: number }) => {
            emitToProjectExcept(payload.projectId, socket.id, 'task:moved', payload);
        });

        socket.on('task:created', (payload: { projectId: string; task: unknown }) => {
            emitToProjectExcept(payload.projectId, socket.id, 'task:created', payload);
        });

        socket.on('task:updated', (payload: { projectId: string; task: unknown }) => {
            emitToProjectExcept(payload.projectId, socket.id, 'task:updated', payload);
        });

        socket.on('task:deleted', (payload: { projectId: string; taskId: string }) => {
            emitToProjectExcept(payload.projectId, socket.id, 'task:deleted', payload);
        });

        socket.on('disconnect', () => {
            for (const projectId of socket.data.joinedProjects ?? []) {
                removePresence(projectId, socket.id);
                socket.to(projectRoom(projectId)).emit('user:left', { projectId, socketId: socket.id });
            }
        });
    });

    return io;
}

export async function startTaskTimer(task: { id: string; projectId: string; timerSeconds: number; startedAt: Date | null }) {
    const updated = await prisma.task.update({
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

export async function stopTaskTimer(taskId: string) {
    const task = await prisma.task.findUnique({
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
    const updated = await prisma.task.update({
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

export function getSocketServer() {
    return io;
}