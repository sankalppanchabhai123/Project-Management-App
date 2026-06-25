"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const http_js_1 = require("../lib/http.js");
function errorHandler(error, _request, response, _next) {
    if (error instanceof http_js_1.HttpError) {
        response.status(error.statusCode).json({ error: error.message });
        return;
    }
    if (error instanceof Error) {
        response.status(500).json({ error: error.message });
        return;
    }
    response.status(500).json({ error: 'Internal Server Error' });
}
