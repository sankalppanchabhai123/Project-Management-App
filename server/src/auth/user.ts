import type { Prisma, User } from '@prisma/client';

export const safeUserSelect = {
    id: true,
    email: true,
    name: true,
    avatar: true,
    provider: true,
    providerId: true,
    createdAt: true,
    updatedAt: true,
} as const satisfies Prisma.UserSelect;

export type SafeUser = Prisma.UserGetPayload<{ select: typeof safeUserSelect }>;

export function toSafeUser(user: User): SafeUser {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        provider: user.provider,
        providerId: user.providerId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    };
}