"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const express_session_1 = __importDefault(require("express-session"));
const passport_1 = __importDefault(require("passport"));
dotenv_1.default.config();
exports.app = (0, express_1.default)();
const clientOrigin = process.env.CLIENT_URL ?? 'http://localhost:5173';
exports.app.use((0, cors_1.default)({
    origin: clientOrigin,
    credentials: true,
}));
exports.app.use(express_1.default.json());
exports.app.use((0, express_session_1.default)({
    secret: process.env.SESSION_SECRET ?? 'development-session-secret',
    resave: false,
    saveUninitialized: false,
}));
exports.app.use(passport_1.default.initialize());
exports.app.use(passport_1.default.session());
exports.app.get('/health', (_request, response) => {
    response.json({ ok: true });
});
