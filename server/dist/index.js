"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_http_1 = require("node:http");
const app_js_1 = require("./app.js");
const socket_io_1 = require("socket.io");
const port = Number(process.env.PORT ?? 4000);
const server = (0, node_http_1.createServer)(app_js_1.app);
const clientOrigin = process.env.CLIENT_URL ?? 'http://localhost:5173';
const io = new socket_io_1.Server(server, {
    cors: {
        origin: clientOrigin,
        credentials: true,
    },
});
io.on('connection', (socket) => {
    socket.emit('connected', { ok: true });
});
server.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
});
