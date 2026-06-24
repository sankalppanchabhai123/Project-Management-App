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
    assigneeId?: string;
    dueDate?: string;
    createdAt: string;
    updatedAt: string;
}