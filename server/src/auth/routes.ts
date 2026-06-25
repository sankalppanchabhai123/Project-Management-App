import { Router } from 'express';
import passport from 'passport';

import { env } from '../config/env.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticateJWT } from '../middleware/authenticateJWT.js';
import { HttpError } from '../lib/http.js';
import {
    REFRESH_TOKEN_COOKIE_NAME,
    getRefreshCookieOptions,
    setRefreshTokenCookieOptions,
    signAccessToken,
    signRefreshToken,
    verifyAuthToken,
} from './tokens.js';
import { hasGitHubAuth, hasGoogleAuth } from './passport.js';

const router = Router();

function frontendRedirectUrl(params: { token?: string; error?: string } = {}) {
    const redirectUrl = new URL(env.CLIENT_URL);
    if (params.token) {
        redirectUrl.searchParams.set('token', params.token);
    }

    if (params.error) {
        redirectUrl.searchParams.set('error', params.error);
    }

    return redirectUrl.toString();
}

function getRefreshTokenFromCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
        return null;
    }

    const cookies = cookieHeader.split(';').map((cookie) => cookie.trim());
    const match = cookies.find((cookie) => cookie.startsWith(`${REFRESH_TOKEN_COOKIE_NAME}=`));
    if (!match) {
        return null;
    }

    return decodeURIComponent(match.slice(REFRESH_TOKEN_COOKIE_NAME.length + 1));
}

function issueTokenPair(userId: string) {
    return {
        accessToken: signAccessToken(userId),
        refreshToken: signRefreshToken(userId),
    };
}

function oauthSuccessHandler(_providerName: string) {
    return asyncHandler(async (request, response) => {
        const user = request.user;

        if (!user) {
            throw new HttpError(401, 'OAuth authentication failed');
        }

        const tokens = issueTokenPair(user.id);

        response.cookie(REFRESH_TOKEN_COOKIE_NAME, tokens.refreshToken, setRefreshTokenCookieOptions());
        response.redirect(frontendRedirectUrl({ token: tokens.accessToken }));
    });
}

function oauthUnavailableHandler(providerName: string) {
    return asyncHandler(async (_request, _response) => {
        throw new HttpError(503, `${providerName} OAuth is not configured`);
    });
}

router.get('/google', hasGoogleAuth() ? passport.authenticate('google', { scope: ['profile', 'email'] }) : oauthUnavailableHandler('Google'));

if (hasGoogleAuth()) {
    router.get(
        '/google/callback',
        passport.authenticate('google', {
            failureRedirect: frontendRedirectUrl({ error: 'oauth_failed' }),
        }),
        oauthSuccessHandler('google')
    );
} else {
    router.get('/google/callback', oauthUnavailableHandler('Google'));
}

router.get('/github', hasGitHubAuth() ? passport.authenticate('github', { scope: ['user:email'] }) : oauthUnavailableHandler('GitHub'));

if (hasGitHubAuth()) {
    router.get(
        '/github/callback',
        passport.authenticate('github', {
            failureRedirect: frontendRedirectUrl({ error: 'oauth_failed' }),
        }),
        oauthSuccessHandler('github')
    );
} else {
    router.get('/github/callback', oauthUnavailableHandler('GitHub'));
}

router.post(
    '/refresh',
    asyncHandler(async (request, response) => {
        const currentRefreshToken = getRefreshTokenFromCookies(request.headers.cookie);

        if (!currentRefreshToken) {
            throw new HttpError(401, 'Missing refresh token');
        }

        const payload = verifyAuthToken(currentRefreshToken);

        if (payload.tokenType !== 'refresh' || typeof payload.sub !== 'string') {
            throw new HttpError(401, 'Invalid refresh token');
        }

        const accessToken = signAccessToken(payload.sub);
        const nextRefreshToken = signRefreshToken(payload.sub);

        response.cookie(REFRESH_TOKEN_COOKIE_NAME, nextRefreshToken, setRefreshTokenCookieOptions());
        response.json({ accessToken });
    })
);

router.post(
    '/logout',
    asyncHandler(async (_request, response) => {
        response.clearCookie(REFRESH_TOKEN_COOKIE_NAME, getRefreshCookieOptions());
        response.json({ ok: true });
    })
);

router.get(
    '/me',
    authenticateJWT,
    asyncHandler(async (request, response) => {
        response.json({ user: request.user });
    })
);

export { router as authRouter };