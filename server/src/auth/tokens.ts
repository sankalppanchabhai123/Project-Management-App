import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';

export const REFRESH_TOKEN_COOKIE_NAME = 'taskflow_refresh_token';

export type AuthTokenType = 'access' | 'refresh';

export interface AuthTokenPayload {
    tokenType: AuthTokenType;
}

const isProduction = process.env.NODE_ENV === 'production';
const refreshSecret = env.JWT_REFRESH_SECRET ?? env.JWT_SECRET;

export function signAccessToken(userId: string) {
    return jwt.sign({ tokenType: 'access' }, env.JWT_SECRET, {
        subject: userId,
        expiresIn: '15m',
    });
}

export function signRefreshToken(userId: string) {
    return jwt.sign({ tokenType: 'refresh' }, refreshSecret, {
        subject: userId,
        expiresIn: '7d',
    });
}

export function verifyAuthToken(token: string) {
    try {
        return jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload & AuthTokenPayload;
    } catch {
        return jwt.verify(token, refreshSecret) as jwt.JwtPayload & AuthTokenPayload;
    }
}

export function getRefreshCookieOptions() {
    return {
        httpOnly: true,
        sameSite: isProduction ? ('none' as const) : ('lax' as const),
        secure: isProduction,
        path: '/auth',
    };
}

export function isRefreshCookieName(name: string) {
    return name === REFRESH_TOKEN_COOKIE_NAME;
}

export function setRefreshTokenCookieOptions() {
    return {
        ...getRefreshCookieOptions(),
        maxAge: 7 * 24 * 60 * 60 * 1000,
    };
}