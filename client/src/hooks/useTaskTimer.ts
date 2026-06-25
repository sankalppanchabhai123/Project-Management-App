import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/axios';
import { useToast } from '../contexts/ToastContext';
import type { PresenceUser } from './useSocket';
import type { BoardTask } from './useKanbanBoard';
import type { Socket } from 'socket.io-client';

function computeDisplaySeconds(task: BoardTask) {
    if (!task.timerRunning || !task.startedAt) {
        return task.timerSeconds;
    }

    const startedAt = new Date(task.startedAt);
    return task.timerSeconds + Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000));
}

export function formatDuration(seconds: number) {
    const hours = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const remaining = String(seconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${remaining}`;
}

type ApplyOptimisticUpdate = (
    taskId: string,
    changes: Partial<BoardTask>,
    request: () => Promise<BoardTask>
) => Promise<BoardTask | null>;

type UseTaskTimerArgs = {
    task: BoardTask;
    socket: Socket | null;
    applyOptimisticUpdate: ApplyOptimisticUpdate;
};

export function useTaskTimer({ task, socket, applyOptimisticUpdate }: UseTaskTimerArgs) {
    const { error } = useToast();
    const [displaySeconds, setDisplaySeconds] = useState(() => computeDisplaySeconds(task));
    const [isRunning, setIsRunning] = useState(task.timerRunning);
    const intervalRef = useRef<number | null>(null);

    useEffect(() => {
        setIsRunning(task.timerRunning);
        setDisplaySeconds(computeDisplaySeconds(task));
    }, [task.id, task.timerRunning, task.timerSeconds, task.startedAt]);

    useEffect(() => {
        if (!isRunning) {
            if (intervalRef.current) {
                window.clearInterval(intervalRef.current);
                intervalRef.current = null;
            }

            return;
        }

        intervalRef.current = window.setInterval(() => {
            setDisplaySeconds((current) => current + 1);
        }, 1000);

        return () => {
            if (intervalRef.current) {
                window.clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [isRunning]);

    const start = async () => {
        try {
            const nextTask = await applyOptimisticUpdate(task.id, { timerRunning: true, startedAt: new Date().toISOString() }, async () => {
                const response = await api.patch(`/api/tasks/${task.id}/timer/start`);
                return response.data.task as BoardTask;
            });

            if (nextTask) {
                socket?.emit('task:updated', { projectId: task.boardId, task: nextTask });
            }

            setIsRunning(true);
        } catch {
            error(`Unable to start timer for ${task.title}`);
        }
    };

    const stop = async () => {
        try {
            const nextTask = await applyOptimisticUpdate(task.id, { timerRunning: false }, async () => {
                const response = await api.patch(`/api/tasks/${task.id}/timer/stop`);
                return response.data.task as BoardTask;
            });

            if (nextTask) {
                socket?.emit('task:updated', { projectId: task.boardId, task: nextTask });
            }

            setIsRunning(false);
        } catch {
            error(`Unable to stop timer for ${task.title}`);
        }
    };

    return useMemo(
        () => ({
            isRunning,
            displaySeconds,
            formatted: formatDuration(displaySeconds),
            start,
            stop,
        }),
        [displaySeconds, isRunning]
    );
}