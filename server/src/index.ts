import { createServer } from 'node:http';
import { app } from './app.js';
import { Server } from 'socket.io';

const port = Number(process.env.PORT ?? 4000);
const server = createServer(app);

const clientOrigin = process.env.CLIENT_URL ?? 'http://localhost:5173';
const io = new Server(server, {
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