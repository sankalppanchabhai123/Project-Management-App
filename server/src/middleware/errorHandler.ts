import type { NextFunction, Request, Response } from 'express';

import { HttpError } from '../lib/http.js';

import { ZodError } from 'zod';

export function errorHandler(error: unknown, _request: Request, response: Response, _next: NextFunction) {
    if (error instanceof HttpError) {
        response.status(error.statusCode).json({ data: null, error: error.message, message: error.message });
        return;
    }

    if (error instanceof ZodError) {
        const message = error.issues.map((issue) => issue.message).join(', ');
        response.status(400).json({ data: null, error: message, message: 'Validation failed' });
        return;
    }

    if (error instanceof Error) {
        response.status(500).json({ data: null, error: error.message, message: 'Internal Server Error' });
        return;
    }

    response.status(500).json({ data: null, error: 'Internal Server Error', message: 'Internal Server Error' });
}