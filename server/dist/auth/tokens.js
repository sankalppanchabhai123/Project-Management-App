"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.REFRESH_TOKEN_COOKIE_NAME = void 0;
exports.signAccessToken = signAccessToken;
exports.signRefreshToken = signRefreshToken;
exports.verifyAuthToken = verifyAuthToken;
exports.getRefreshCookieOptions = getRefreshCookieOptions;
exports.isRefreshCookieName = isRefreshCookieName;
exports.setRefreshTokenCookieOptions = setRefreshTokenCookieOptions;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_js_1 = require("../config/env.js");
exports.REFRESH_TOKEN_COOKIE_NAME = 'taskflow_refresh_token';
const isProduction = process.env.NODE_ENV === 'production';
const refreshSecret = env_js_1.env.JWT_REFRESH_SECRET ?? env_js_1.env.JWT_SECRET;
function signAccessToken(userId) {
    return jsonwebtoken_1.default.sign({ tokenType: 'access' }, env_js_1.env.JWT_SECRET, {
        subject: userId,
        expiresIn: '15m',
    });
}
function signRefreshToken(userId) {
    return jsonwebtoken_1.default.sign({ tokenType: 'refresh' }, refreshSecret, {
        subject: userId,
        expiresIn: '7d',
    });
}
function verifyAuthToken(token) {
    try {
        return jsonwebtoken_1.default.verify(token, env_js_1.env.JWT_SECRET);
    }
    catch {
        return jsonwebtoken_1.default.verify(token, refreshSecret);
    }
}
function getRefreshCookieOptions() {
    return {
        httpOnly: true,
        sameSite: isProduction ? 'none' : 'lax',
        secure: isProduction,
        path: '/auth',
    };
}
function isRefreshCookieName(name) {
    return name === exports.REFRESH_TOKEN_COOKIE_NAME;
}
function setRefreshTokenCookieOptions() {
    return {
        ...getRefreshCookieOptions(),
        maxAge: 7 * 24 * 60 * 60 * 1000,
    };
}
