import { PrismaClient, Provider } from '@prisma/client';
import passport from 'passport';
import { Strategy as GitHubStrategy, type Profile as GitHubProfile } from 'passport-github2';
import { Strategy as GoogleStrategy, type Profile as GoogleProfile } from 'passport-google-oauth20';

import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { findOrCreateOAuthUser } from './service.js';
import { safeUserSelect, type SafeUser } from './user.js';

const isGoogleConfigured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CALLBACK_URL);
const isGitHubConfigured = Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET && env.GITHUB_CALLBACK_URL);

type PassportDone = (error: Error | null, user?: SafeUser | false) => void;

function getPrismaClient() {
    return prisma;
}

export function configurePassport() {
    passport.serializeUser((user: SafeUser, done) => {
        done(null, user.id);
    });

    passport.deserializeUser(async (userId: string, done) => {
        try {
            const user = await getPrismaClient().user.findUnique({
                where: { id: userId },
                select: safeUserSelect,
            });

            done(null, user ?? false);
        } catch (error) {
            done(error as Error);
        }
    });

    if (isGoogleConfigured) {
        passport.use(
            new GoogleStrategy(
                {
                    clientID: env.GOOGLE_CLIENT_ID!,
                    clientSecret: env.GOOGLE_CLIENT_SECRET!,
                    callbackURL: env.GOOGLE_CALLBACK_URL!,
                },
                async (_accessToken: string, _refreshToken: string, profile: GoogleProfile, done: PassportDone) => {
                    try {
                        const user = await findOrCreateOAuthUser(getPrismaClient(), Provider.GOOGLE, profile);
                        done(null, user);
                    } catch (error) {
                        done(error as Error);
                    }
                }
            )
        );
    }

    if (isGitHubConfigured) {
        passport.use(
            new GitHubStrategy(
                {
                    clientID: env.GITHUB_CLIENT_ID!,
                    clientSecret: env.GITHUB_CLIENT_SECRET!,
                    callbackURL: env.GITHUB_CALLBACK_URL!,
                    scope: ['user:email'],
                },
                async (_accessToken: string, _refreshToken: string, profile: GitHubProfile, done: PassportDone) => {
                    try {
                        const user = await findOrCreateOAuthUser(getPrismaClient(), Provider.GITHUB, profile);
                        done(null, user);
                    } catch (error) {
                        done(error as Error);
                    }
                }
            )
        );
    }
}

export function hasGoogleAuth() {
    return isGoogleConfigured;
}

export function hasGitHubAuth() {
    return isGitHubConfigured;
}