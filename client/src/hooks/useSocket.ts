import { useEffect, useMemo, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { setSocketId } from '../api/axios';
import type { BoardTask, TaskStatus } from './useKanbanBoard';

export type PresenceUser = {
    socketId: string;
    id: string;
    name: string;
    avatarUrl?: string;
};

type UseSocketArgs = {
    projectId?: string;
    accessToken: string | null;
    onTaskMoved?: (payload: { taskId: string; status: TaskStatus; position: number }) => void;
    onTaskCreated?: (task: BoardTask) => void;
    onTaskUpdated?: (task: BoardTask) => void;
    onTaskDeleted?: (taskId: string) => void;
    onTimerTick?: (payload: { taskId: string; timerSeconds: number; startedAt: string }) => void;
    onPresenceChange?: (users: PresenceUser[]) => void;
};

let socket: Socket | null = null;

function getSocket(accessToken: string | null) {
    if (!socket) {
        socket = io(import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000', {
            autoConnect: false,
            withCredentials: true,
            auth: { token: accessToken },
        });
    import { useEffect, useMemo, useState } from 'react';
    import { io, type Socket } from 'socket.io-client';
    import { setSocketId } from '../api/axios';
    import type { BoardTask, TaskStatus } from './useKanbanBoard';

    export type PresenceUser = {
        socketId: string;
        id: string;
        name: string;
        avatarUrl?: string;
    };

    type UseSocketArgs = {
        projectId?: string;
        accessToken: string | null;
        onTaskMoved?: (payload: { taskId: string; status: TaskStatus; position: number }) => void;
        onTaskCreated?: (task: BoardTask) => void;
        onTaskUpdated?: (task: BoardTask) => void;
        onTaskDeleted?: (taskId: string) => void;
        onTimerTick?: (payload: { taskId: string; timerSeconds: number; startedAt: string }) => void;
        onPresenceChange?: (users: PresenceUser[]) => void;
    };

    let socket: Socket | null = null;

    function getSocket(accessToken: string | null) {
        if (!socket) {
            socket = io(import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000', {
                autoConnect: false,
                withCredentials: true,
                auth: { token: accessToken },
            });
        }

        socket.auth = { token: accessToken };
        return socket;
    }

    export function useSocket({
        projectId,
        accessToken,
        onTaskMoved,
        onTaskCreated,
        onTaskUpdated,
        onTaskDeleted,
        onTimerTick,
        onPresenceChange,
    }: UseSocketArgs) {
        const currentSocket = getSocket(accessToken);
        const [connected, setConnected] = useState(currentSocket.connected);
        const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);

        useEffect(() => {
            const handleConnect = () => {
                setConnected(true);
                setSocketId(currentSocket.id ?? null);
            };

            const handleDisconnect = () => {
                setConnected(false);
                setSocketId(null);
            };

            const handlePresenceState = (payload: { projectId: string; users: PresenceUser[] }) => {
                if (payload.projectId !== projectId) {
                    return;
                }

                setOnlineUsers(payload.users);
                onPresenceChange?.(payload.users);
            };

            const handleTaskMoved = (payload: { taskId: string; status: TaskStatus; position: number }) => onTaskMoved?.(payload);
            const handleTaskCreated = (payload: { task: BoardTask }) => onTaskCreated?.(payload.task);
            const handleTaskUpdated = (payload: { task: BoardTask }) => onTaskUpdated?.(payload.task);
            const handleTaskDeleted = (payload: { taskId: string }) => onTaskDeleted?.(payload.taskId);
            const handleTimerTick = (payload: { taskId: string; timerSeconds: number; startedAt: string }) => onTimerTick?.(payload);

            currentSocket.on('connect', handleConnect);
            currentSocket.on('disconnect', handleDisconnect);
            currentSocket.on('presence:state', handlePresenceState);
            currentSocket.on('task:moved', handleTaskMoved);
            currentSocket.on('task:created', handleTaskCreated);
            currentSocket.on('task:updated', handleTaskUpdated);
            currentSocket.on('task:deleted', handleTaskDeleted);
            currentSocket.on('timer:tick', handleTimerTick);

            if (!currentSocket.connected && accessToken) {
                currentSocket.connect();
            }

            return () => {
                currentSocket.off('connect', handleConnect);
                currentSocket.off('disconnect', handleDisconnect);
                currentSocket.off('presence:state', handlePresenceState);
                currentSocket.off('task:moved', handleTaskMoved);
                currentSocket.off('task:created', handleTaskCreated);
                currentSocket.off('task:updated', handleTaskUpdated);
                currentSocket.off('task:deleted', handleTaskDeleted);
                currentSocket.off('timer:tick', handleTimerTick);
            };
        }, [accessToken, currentSocket, onPresenceChange, onTaskCreated, onTaskDeleted, onTaskMoved, onTaskUpdated, onTimerTick, projectId]);

        useEffect(() => {
            if (!projectId || !accessToken) {
                return;
            }

            const joinProject = () => currentSocket.emit('join-project', projectId);

            if (currentSocket.connected) {
                joinProject();
            } else {
                currentSocket.once('connect', joinProject);
            }

            return () => {
                currentSocket.emit('leave-project', projectId);
                currentSocket.off('connect', joinProject);
            };
        }, [accessToken, currentSocket, projectId]);

        return useMemo(
            () => ({
                socket: currentSocket,
                connected,
                onlineUsers,
            }),
            [connected, currentSocket, onlineUsers]
        );
    }
