"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_http_1 = require("node:http");
const app_js_1 = require("./app.js");
const realtime_js_1 = require("./realtime.js");
const port = Number(process.env.PORT ?? 4000);
const server = (0, node_http_1.createServer)(app_js_1.app);
(0, realtime_js_1.initializeRealtime)(server);
void (0, realtime_js_1.restoreRunningTimers)();
server.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
});
