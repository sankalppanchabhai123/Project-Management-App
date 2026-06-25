import { createServer } from 'node:http';
import { app } from './app.js';
import { initializeRealtime, restoreRunningTimers } from './realtime.js';

const port = Number(process.env.PORT ?? 4000);
const server = createServer(app);

initializeRealtime(server);
void restoreRunningTimers();

server.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
});