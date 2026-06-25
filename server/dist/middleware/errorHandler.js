"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const http_js_1 = require("../lib/http.js");
const zod_1 = require("zod");
function errorHandler(error, _request, response, _next) {
    if (error instanceof http_js_1.HttpError) {
        response.status(error.statusCode).json({ data: null, error: error.message, message: error.message });
        return;
    }
    if (error instanceof zod_1.ZodError) {
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
