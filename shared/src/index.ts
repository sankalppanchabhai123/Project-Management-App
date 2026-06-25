export type UserRole = 'admin' | 'member';

export interface Board {
    id: string;
    name: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
}

export interface TaskCard {
    id: string;
    boardId: string;
    title: string;
    description?: string;
    status: 'todo' | 'in-progress' | 'done';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    tags: string[];
    assigneeName?: string;
    assigneeAvatarUrl?: string;
    assigneeId?: string;
    dueDate?: string;
    timerSeconds: number;
    timerRunning: boolean;
    startedAt?: string | null;
    createdAt: string;
    updatedAt: string;
}