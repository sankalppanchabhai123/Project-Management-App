import { useMemo } from 'react';
import type { TaskCard } from '@taskflow/shared';

const demoTasks: TaskCard[] = [
    {
        id: 'task-1',
        boardId: 'proj-1',
        title: 'Create wireframes',
        status: 'todo',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        id: 'task-2',
        boardId: 'proj-1',
        title: 'Review copy',
        status: 'in-progress',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
];

export function useTasks(projectId?: string) {
    return useMemo(
        () => ({
            tasks: demoTasks.filter((task) => (projectId ? task.boardId === projectId : true)),
            isLoading: false,
        }),
        [projectId]
    );
}
