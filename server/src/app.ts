import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import session from 'express-session';
import passport from 'passport';

dotenv.config();

export const app = express();

const clientOrigin = process.env.CLIENT_URL ?? 'http://localhost:5173';

app.use(
    cors({
        origin: clientOrigin,
        credentials: true,
    })
);
app.use(express.json());
app.use(
    session({
        secret: process.env.SESSION_SECRET ?? 'development-session-secret',
        resave: false,
        saveUninitialized: false,
    })
);
app.use(passport.initialize());
app.use(passport.session());

app.get('/health', (_request, response) => {
    response.json({ ok: true });
});
