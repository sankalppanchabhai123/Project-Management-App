import cors from 'cors';
import express from 'express';
import session from 'express-session';
import passport from 'passport';

import { authRouter } from './auth/routes.js';
import { configurePassport } from './auth/passport.js';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';

export const app = express();

configurePassport();

const clientOrigin = env.CLIENT_URL;

app.use(
    cors({
        origin: clientOrigin,
        credentials: true,
    })
);
app.use(express.json());
app.use(
    session({
        secret: env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
        },
    })
);
app.use(passport.initialize());
app.use(passport.session());

app.use('/auth', authRouter);

app.get('/health', (_request, response) => {
    response.json({ ok: true });
});

app.use(errorHandler);
