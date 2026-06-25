"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    PORT: zod_1.z.string().optional(),
    CLIENT_URL: zod_1.z.string().url(),
    SERVER_URL: zod_1.z.string().url().optional(),
    DATABASE_URL: zod_1.z.string().min(1),
    JWT_SECRET: zod_1.z.string().min(1),
    JWT_REFRESH_SECRET: zod_1.z.string().min(1).optional(),
    SESSION_SECRET: zod_1.z.string().min(1),
    GOOGLE_CLIENT_ID: zod_1.z.string().optional(),
    GOOGLE_CLIENT_SECRET: zod_1.z.string().optional(),
    GOOGLE_CALLBACK_URL: zod_1.z.string().url().optional(),
    GITHUB_CLIENT_ID: zod_1.z.string().optional(),
    GITHUB_CLIENT_SECRET: zod_1.z.string().optional(),
    GITHUB_CALLBACK_URL: zod_1.z.string().url().optional(),
});
exports.env = envSchema.parse(process.env);
