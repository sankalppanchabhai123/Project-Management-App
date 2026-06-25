"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const passport_1 = __importDefault(require("passport"));
const env_js_1 = require("../config/env.js");
const asyncHandler_js_1 = require("../middleware/asyncHandler.js");
const authenticateJWT_js_1 = require("../middleware/authenticateJWT.js");
const http_js_1 = require("../lib/http.js");
const tokens_js_1 = require("./tokens.js");
const passport_js_1 = require("./passport.js");
const router = (0, express_1.Router)();
exports.authRouter = router;
function frontendRedirectUrl(params = {}) {
    const redirectUrl = new URL(env_js_1.env.CLIENT_URL);
    if (params.token) {
        redirectUrl.searchParams.set('token', params.token);
    }
    if (params.error) {
        redirectUrl.searchParams.set('error', params.error);
    }
    return redirectUrl.toString();
}
function getRefreshTokenFromCookies(cookieHeader) {
    if (!cookieHeader) {
        return null;
    }
    const cookies = cookieHeader.split(';').map((cookie) => cookie.trim());
    const match = cookies.find((cookie) => cookie.startsWith(`${tokens_js_1.REFRESH_TOKEN_COOKIE_NAME}=`));
    if (!match) {
        return null;
    }
    return decodeURIComponent(match.slice(tokens_js_1.REFRESH_TOKEN_COOKIE_NAME.length + 1));
}
function issueTokenPair(userId) {
    return {
        accessToken: (0, tokens_js_1.signAccessToken)(userId),
        refreshToken: (0, tokens_js_1.signRefreshToken)(userId),
    };
}
function oauthSuccessHandler(_providerName) {
    return (0, asyncHandler_js_1.asyncHandler)(async (request, response) => {
        const user = request.user;
        if (!user) {
            throw new http_js_1.HttpError(401, 'OAuth authentication failed');
        }
        const tokens = issueTokenPair(user.id);
        response.cookie(tokens_js_1.REFRESH_TOKEN_COOKIE_NAME, tokens.refreshToken, (0, tokens_js_1.setRefreshTokenCookieOptions)());
        response.redirect(frontendRedirectUrl({ token: tokens.accessToken }));
    });
}
function oauthUnavailableHandler(providerName) {
    return (0, asyncHandler_js_1.asyncHandler)(async (_request, _response) => {
        throw new http_js_1.HttpError(503, `${providerName} OAuth is not configured`);
    });
}
router.get('/google', (0, passport_js_1.hasGoogleAuth)() ? passport_1.default.authenticate('google', { scope: ['profile', 'email'] }) : oauthUnavailableHandler('Google'));
if ((0, passport_js_1.hasGoogleAuth)()) {
    router.get('/google/callback', passport_1.default.authenticate('google', {
        failureRedirect: frontendRedirectUrl({ error: 'oauth_failed' }),
    }), oauthSuccessHandler('google'));
}
else {
    router.get('/google/callback', oauthUnavailableHandler('Google'));
}
router.get('/github', (0, passport_js_1.hasGitHubAuth)() ? passport_1.default.authenticate('github', { scope: ['user:email'] }) : oauthUnavailableHandler('GitHub'));
if ((0, passport_js_1.hasGitHubAuth)()) {
    router.get('/github/callback', passport_1.default.authenticate('github', {
        failureRedirect: frontendRedirectUrl({ error: 'oauth_failed' }),
    }), oauthSuccessHandler('github'));
}
else {
    router.get('/github/callback', oauthUnavailableHandler('GitHub'));
}
router.post('/refresh', (0, asyncHandler_js_1.asyncHandler)(async (request, response) => {
    const currentRefreshToken = getRefreshTokenFromCookies(request.headers.cookie);
    if (!currentRefreshToken) {
        throw new http_js_1.HttpError(401, 'Missing refresh token');
    }
    const payload = (0, tokens_js_1.verifyAuthToken)(currentRefreshToken);
    if (payload.tokenType !== 'refresh' || typeof payload.sub !== 'string') {
        throw new http_js_1.HttpError(401, 'Invalid refresh token');
    }
    const accessToken = (0, tokens_js_1.signAccessToken)(payload.sub);
    const nextRefreshToken = (0, tokens_js_1.signRefreshToken)(payload.sub);
    response.cookie(tokens_js_1.REFRESH_TOKEN_COOKIE_NAME, nextRefreshToken, (0, tokens_js_1.setRefreshTokenCookieOptions)());
    response.json({ accessToken });
}));
router.post('/logout', (0, asyncHandler_js_1.asyncHandler)(async (_request, response) => {
    response.clearCookie(tokens_js_1.REFRESH_TOKEN_COOKIE_NAME, (0, tokens_js_1.getRefreshCookieOptions)());
    response.json({ ok: true });
}));
router.get('/me', authenticateJWT_js_1.authenticateJWT, (0, asyncHandler_js_1.asyncHandler)(async (request, response) => {
    response.json({ user: request.user });
}));
