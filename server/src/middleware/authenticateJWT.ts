import type { NextFunction, Request, Response } from 'express';

import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/http.js';
import { verifyAuthToken } from '../auth/tokens.js';
import { safeUserSelect } from '../auth/user.js';
import type { SafeUser } from '../auth/user.js';

function extractBearerToken(authorizationHeader: string | undefined) {
    if (!authorizationHeader) {
        return null;
    }

    const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
    return match ? match[1] : null;
}

async function resolveUserFromAccessToken(token: string) {
    const payload = verifyAuthToken(token);

    if (payload.tokenType !== 'access' || typeof payload.sub !== 'string') {
        throw new HttpError(401, 'Invalid access token');
    }

    const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: safeUserSelect,
    });

    if (!user) {
        throw new HttpError(401, 'User not found');
    }

    return user;
}

export async function authenticateJWT(request: Request, _response: Response, next: NextFunction) {
    try {
        const token = extractBearerToken(request.headers.authorization);

        if (!token) {
            throw new HttpError(401, 'Missing Bearer token');
        }

        const user = await resolveUserFromAccessToken(token);
        request.user = user;
        next();
    } catch (error) {
        next(error);
    }
}

export async function getUserFromAccessToken(token: string): Promise<SafeUser> {
    return resolveUserFromAccessToken(token);
}