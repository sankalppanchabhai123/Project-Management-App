import type { NextFunction, Request, Response } from 'express';

import { getUserFromAccessToken } from './authenticateJWT.js';

function extractBearerToken(authorizationHeader: string | undefined) {
    if (!authorizationHeader) {
        return null;
    }

    const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
    return match ? match[1] : null;
}

export async function optionalAuth(request: Request, _response: Response, next: NextFunction) {
    const token = extractBearerToken(request.headers.authorization);

    if (!token) {
        next();
        return;
    }

    try {
        request.user = await getUserFromAccessToken(token);
    } catch {
        request.user = undefined;
    }

    next();
}