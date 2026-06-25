import { useMemo } from 'react';
import type { Board } from '@taskflow/shared';

const demoProjects: Board[] = [
    {
        id: 'proj-1',
        name: 'Website Redesign',
        description: 'Marketing site refresh',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        id: 'proj-2',
        name: 'Mobile App Launch',
        description: 'Release coordination',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
];

export function useProjects() {
    return useMemo(
        () => ({
            projects: demoProjects,
            isLoading: false,
        }),
        []
    );
}
