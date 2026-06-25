"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = optionalAuth;
const authenticateJWT_js_1 = require("./authenticateJWT.js");
function extractBearerToken(authorizationHeader) {
    if (!authorizationHeader) {
        return null;
    }
    const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
    return match ? match[1] : null;
}
async function optionalAuth(request, _response, next) {
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
        next();
        return;
    }
    try {
        request.user = await (0, authenticateJWT_js_1.getUserFromAccessToken)(token);
    }
    catch {
        request.user = undefined;
    }
    next();
}
