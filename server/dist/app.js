"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const express_session_1 = __importDefault(require("express-session"));
const passport_1 = __importDefault(require("passport"));
const routes_js_1 = require("./auth/routes.js");
const passport_js_1 = require("./auth/passport.js");
const env_js_1 = require("./config/env.js");
const errorHandler_js_1 = require("./middleware/errorHandler.js");
exports.app = (0, express_1.default)();
(0, passport_js_1.configurePassport)();
const clientOrigin = env_js_1.env.CLIENT_URL;
exports.app.use((0, cors_1.default)({
    origin: clientOrigin,
    credentials: true,
}));
exports.app.use(express_1.default.json());
exports.app.use((0, express_session_1.default)({
    secret: env_js_1.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
    },
}));
exports.app.use(passport_1.default.initialize());
exports.app.use(passport_1.default.session());
exports.app.use('/auth', routes_js_1.authRouter);
exports.app.get('/health', (_request, response) => {
    response.json({ ok: true });
});
exports.app.use(errorHandler_js_1.errorHandler);
