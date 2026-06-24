import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
    PORT: z.string().optional(),
    CLIENT_URL: z.string().url(),
    SERVER_URL: z.string().url().optional(),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(1),
    SESSION_SECRET: z.string().min(1),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_CALLBACK_URL: z.string().url().optional(),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    GITHUB_CALLBACK_URL: z.string().url().optional(),
});

export const env = envSchema.parse(process.env);