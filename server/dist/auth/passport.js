"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configurePassport = configurePassport;
exports.hasGoogleAuth = hasGoogleAuth;
exports.hasGitHubAuth = hasGitHubAuth;
const client_1 = require("@prisma/client");
const passport_1 = __importDefault(require("passport"));
const passport_github2_1 = require("passport-github2");
const passport_google_oauth20_1 = require("passport-google-oauth20");
const env_js_1 = require("../config/env.js");
const prisma_js_1 = require("../lib/prisma.js");
const service_js_1 = require("./service.js");
const user_js_1 = require("./user.js");
const isGoogleConfigured = Boolean(env_js_1.env.GOOGLE_CLIENT_ID && env_js_1.env.GOOGLE_CLIENT_SECRET && env_js_1.env.GOOGLE_CALLBACK_URL);
const isGitHubConfigured = Boolean(env_js_1.env.GITHUB_CLIENT_ID && env_js_1.env.GITHUB_CLIENT_SECRET && env_js_1.env.GITHUB_CALLBACK_URL);
function getPrismaClient() {
    return prisma_js_1.prisma;
}
function configurePassport() {
    passport_1.default.serializeUser((user, done) => {
        done(null, user.id);
    });
    passport_1.default.deserializeUser(async (userId, done) => {
        try {
            const user = await getPrismaClient().user.findUnique({
                where: { id: userId },
                select: user_js_1.safeUserSelect,
            });
            done(null, user ?? false);
        }
        catch (error) {
            done(error);
        }
    });
    if (isGoogleConfigured) {
        passport_1.default.use(new passport_google_oauth20_1.Strategy({
            clientID: env_js_1.env.GOOGLE_CLIENT_ID,
            clientSecret: env_js_1.env.GOOGLE_CLIENT_SECRET,
            callbackURL: env_js_1.env.GOOGLE_CALLBACK_URL,
        }, async (_accessToken, _refreshToken, profile, done) => {
            try {
                const user = await (0, service_js_1.findOrCreateOAuthUser)(getPrismaClient(), client_1.Provider.GOOGLE, profile);
                done(null, user);
            }
            catch (error) {
                done(error);
            }
        }));
    }
    if (isGitHubConfigured) {
        passport_1.default.use(new passport_github2_1.Strategy({
            clientID: env_js_1.env.GITHUB_CLIENT_ID,
            clientSecret: env_js_1.env.GITHUB_CLIENT_SECRET,
            callbackURL: env_js_1.env.GITHUB_CALLBACK_URL,
            scope: ['user:email'],
        }, async (_accessToken, _refreshToken, profile, done) => {
            try {
                const user = await (0, service_js_1.findOrCreateOAuthUser)(getPrismaClient(), client_1.Provider.GITHUB, profile);
                done(null, user);
            }
            catch (error) {
                done(error);
            }
        }));
    }
}
function hasGoogleAuth() {
    return isGoogleConfigured;
}
function hasGitHubAuth() {
    return isGitHubConfigured;
}
