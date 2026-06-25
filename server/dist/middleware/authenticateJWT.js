"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateJWT = authenticateJWT;
exports.getUserFromAccessToken = getUserFromAccessToken;
const prisma_js_1 = require("../lib/prisma.js");
const http_js_1 = require("../lib/http.js");
const tokens_js_1 = require("../auth/tokens.js");
const user_js_1 = require("../auth/user.js");
function extractBearerToken(authorizationHeader) {
    if (!authorizationHeader) {
        return null;
    }
    const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
    return match ? match[1] : null;
}
async function resolveUserFromAccessToken(token) {
    const payload = (0, tokens_js_1.verifyAuthToken)(token);
    if (payload.tokenType !== 'access' || typeof payload.sub !== 'string') {
        throw new http_js_1.HttpError(401, 'Invalid access token');
    }
    const user = await prisma_js_1.prisma.user.findUnique({
        where: { id: payload.sub },
        select: user_js_1.safeUserSelect,
    });
    if (!user) {
        throw new http_js_1.HttpError(401, 'User not found');
    }
    return user;
}
async function authenticateJWT(request, _response, next) {
    try {
        const token = extractBearerToken(request.headers.authorization);
        if (!token) {
            throw new http_js_1.HttpError(401, 'Missing Bearer token');
        }
        const user = await resolveUserFromAccessToken(token);
        request.user = user;
        next();
    }
    catch (error) {
        next(error);
    }
}
async function getUserFromAccessToken(token) {
    return resolveUserFromAccessToken(token);
}
