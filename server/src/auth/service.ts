import type { PrismaClient } from '@prisma/client';

import { safeUserSelect, type SafeUser } from './user.js';

type OAuthProfile = {
    id: string;
    displayName?: string;
    emails?: Array<{ value: string }>;
    photos?: Array<{ value: string }>;
    username?: string;
    _json?: Record<string, unknown> & {
        avatar_url?: string;
        email?: string;
        name?: string;
        login?: string;
    };
};

type OAuthProvider = 'GOOGLE' | 'GITHUB';

function pickPrimaryEmail(profile: OAuthProfile, provider: OAuthProvider) {
    const email = profile.emails?.[0]?.value ?? profile._json?.email;
    if (email) {
        return email;
    }

    return `${provider.toLowerCase()}-${profile.id}@taskflow.local`;
}

function pickDisplayName(profile: OAuthProfile) {
    return profile.displayName ?? profile._json?.name ?? profile.username ?? 'Taskflow User';
}

function pickAvatar(profile: OAuthProfile) {
    return profile.photos?.[0]?.value ?? profile._json?.avatar_url ?? undefined;
}

export async function findOrCreateOAuthUser(
    prisma: PrismaClient,
    provider: OAuthProvider,
    profile: OAuthProfile
): Promise<SafeUser> {
    const providerId = profile.id;
    const email = pickPrimaryEmail(profile, provider);
    const name = pickDisplayName(profile);
    const avatar = pickAvatar(profile);

    const existingUser = await prisma.user.findFirst({
        where: {
            OR: [{ provider, providerId }, { email }],
        },
        select: safeUserSelect,
    });

    if (existingUser) {
        const updatedUser = await prisma.user.update({
            where: { id: existingUser.id },
            data: {
                name,
                avatar,
                provider,
                providerId,
                email,
            },
            select: safeUserSelect,
        });

        return updatedUser;
    }

    return prisma.user.create({
        data: {
            email,
            name,
            avatar,
            provider,
            providerId,
        },
        select: safeUserSelect,
    });
}