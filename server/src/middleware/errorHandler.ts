import type { NextFunction, Request, Response } from 'express';

import { HttpError } from '../lib/http.js';

export function errorHandler(error: unknown, _request: Request, response: Response, _next: NextFunction) {
    if (error instanceof HttpError) {
        response.status(error.statusCode).json({ error: error.message });
        return;
    }

    if (error instanceof Error) {
        response.status(500).json({ error: error.message });
        return;
    }

    response.status(500).json({ error: 'Internal Server Error' });
}