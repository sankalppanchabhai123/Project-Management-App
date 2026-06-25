import { useMemo, useRef, useState } from 'react';
import type { TaskCard } from '@taskflow/shared';
import { useToast } from '../contexts/ToastContext';

export type TaskStatus = TaskCard['status'];

export type BoardTask = TaskCard;

export type KanbanBoardState = {
    tasks: BoardTask[];
    setTasks: React.Dispatch<React.SetStateAction<BoardTask[]>>;
    moveTask: (taskId: string, destinationStatus: TaskStatus, destinationIndex: number) => void;
    updateTask: (taskId: string, updater: (task: BoardTask) => BoardTask) => void;
    insertTask: (task: BoardTask, prepend?: boolean) => void;
    removeTask: (taskId: string) => void;
    applyOptimisticUpdate: (taskId: string, changes: Partial<BoardTask>, request: () => Promise<BoardTask>) => Promise<BoardTask | null>;
};

const demoTasks: BoardTask[] = [
    {
        id: 'task-1',
        boardId: 'proj-1',
        title: 'Finalize project roadmap for Q3 launch',
        description: 'Lock the milestone sequence and identify the critical dependencies before sprint planning starts.',
        status: 'todo',
        priority: 'high',
        tags: ['Roadmap', 'Planning'],
        assigneeName: 'Ava Chen',
        assigneeAvatarUrl: '',
        dueDate: '2026-06-30',
        timerSeconds: 435,
        timerRunning: false,
        startedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        id: 'task-2',
        boardId: 'proj-1',
        title: 'Design onboarding checklist',
        description: 'Create a frictionless first-run checklist for new project owners.',
        status: 'todo',
        priority: 'medium',
        tags: ['UX', 'Onboarding'],
        assigneeName: 'Noah Patel',
        assigneeAvatarUrl: '',
        dueDate: '2026-07-02',
        timerSeconds: 122,
        timerRunning: false,
        startedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        id: 'task-3',
        boardId: 'proj-1',
        title: 'Implement drag-and-drop board layout',
        description: 'Wire the board columns, task cards, and optimistic move handling.',
        status: 'in-progress',
        priority: 'urgent',
        tags: ['Frontend', 'DnD'],
        assigneeName: 'Mia Rivera',
        assigneeAvatarUrl: '',
        dueDate: '2026-06-26',
        timerSeconds: 987,
        timerRunning: true,
        startedAt: new Date(Date.now() - 120_000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        id: 'task-4',
        boardId: 'proj-1',
        title: 'Review backend task move endpoint',
        description: 'Confirm PATCH /api/tasks/:id/move and socket broadcast payload shape.',
        status: 'done',
        priority: 'low',
        tags: ['API', 'Backend'],
        assigneeName: 'Liam Brooks',
        assigneeAvatarUrl: '',
        dueDate: '2026-06-24',
        timerSeconds: 1460,
        timerRunning: false,
        startedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
];

function sortTasks(tasks: BoardTask[]) {
    const statusOrder: Record<TaskStatus, number> = { todo: 0, 'in-progress': 1, done: 2 };

    return [...tasks].sort((left, right) => {
        if (left.status !== right.status) {
            return statusOrder[left.status] - statusOrder[right.status];
        }

        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });
}

function insertTaskIntoState(tasks: BoardTask[], task: BoardTask, prepend = false) {
    const withoutTask = tasks.filter((entry) => entry.id !== task.id);
    const matching = withoutTask.filter((entry) => entry.status === task.status);
    const targetIndex = prepend ? 0 : matching.length;
    const sameStatusIndices = withoutTask.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.status === task.status);
    const insertionPoint = targetIndex >= sameStatusIndices.length ? withoutTask.length : sameStatusIndices[targetIndex].index;
    const nextTasks = [...withoutTask];
    nextTasks.splice(insertionPoint, 0, task);
    return sortTasks(nextTasks);
}

export function useKanbanBoard(projectId?: string) {
    const [tasks, setTasks] = useState<BoardTask[]>(() =>
        demoTasks.filter((task) => (projectId ? task.boardId === projectId : true))
    );
    const snapshotRef = useRef(tasks);
    const { error } = useToast();

    snapshotRef.current = tasks;

    const moveTask = (taskId: string, destinationStatus: TaskStatus, destinationIndex: number) => {
        setTasks((currentTasks) => {
            const currentTask = currentTasks.find((task) => task.id === taskId);

            if (!currentTask) {
                return currentTasks;
            }

            const nextTasks = currentTasks.filter((task) => task.id !== taskId);
            const movedTask = { ...currentTask, status: destinationStatus, updatedAt: new Date().toISOString() };
            const targetTasks = nextTasks.filter((task) => task.status === destinationStatus);
            const sameStatusIndices = nextTasks.map((task, index) => ({ task, index })).filter(({ task }) => task.status === destinationStatus);
            const insertionPoint =
                destinationIndex >= targetTasks.length ? nextTasks.length : sameStatusIndices[destinationIndex].index;

            nextTasks.splice(insertionPoint, 0, movedTask);
            return sortTasks(nextTasks);
        });
    };

    const updateTask = (taskId: string, updater: (task: BoardTask) => BoardTask) => {
        setTasks((currentTasks) => sortTasks(currentTasks.map((task) => (task.id === taskId ? updater(task) : task))));
    };

    const insertTask = (task: BoardTask, prepend = false) => {
        setTasks((currentTasks) => insertTaskIntoState(currentTasks, task, prepend));
    };

    const removeTask = (taskId: string) => {
        setTasks((currentTasks) => currentTasks.filter((task) => task.id !== taskId));
    };

    const applyOptimisticUpdate = async (taskId: string, changes: Partial<BoardTask>, request: () => Promise<BoardTask>) => {
        const snapshot = snapshotRef.current;

        setTasks((currentTasks) =>
            sortTasks(
                currentTasks.map((task) =>
                    task.id === taskId ? { ...task, ...changes, updatedAt: new Date().toISOString() } : task
                )
            )
        );

        try {
            const serverTask = await request();
            setTasks((currentTasks) => sortTasks(currentTasks.map((task) => (task.id === taskId ? { ...task, ...serverTask } : task))));
            return serverTask;
        } catch {
            setTasks(snapshot);
            error('Unable to save task changes.');
            return null;
        }
    };

    return useMemo(
        () => ({
            tasks,
            setTasks,
            moveTask,
            updateTask,
            insertTask,
            removeTask,
            applyOptimisticUpdate,
        }),
        [tasks]
    );
}