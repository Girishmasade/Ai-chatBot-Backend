/**
 * Socket.IO server bootstrap.
 *
 * Creates the Express app, HTTP server, and typed Socket.IO server,
 * then wires up authentication middleware and event handlers.
 *
 * Exports `app`, `server`, and `io` for use in server.ts.
 */

import express from "express";

import { createServer } from "node:http";
import { Server } from "socket.io";
import { allowedCorsType } from "@/config/cors.config.js";
import { socketAuthMiddleware } from "./socket.auth.js";
import { registerSocketHandlers } from "./socket.handler.js";
import { setIO } from "./socket.emitter.js";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "./socket.types.js";

const app = express();

const server = createServer(app);

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(server, {
  cors: {
    origin: allowedCorsType,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  },
  // Ping every 25s, timeout after 20s of no pong — keeps connections alive
  // across load-balancers and detects dead sockets quickly.
  pingInterval: 25000,
  pingTimeout: 20000,
});

// Make the io instance available to the emitter helpers
setIO(io);

// ── Authentication middleware ───────────────────────────────────────────────
// Every connection must pass JWT verification before any events are handled.
io.use(socketAuthMiddleware);

// ── Connection handler ──────────────────────────────────────────────────────
io.on("connection", (socket) => {
  registerSocketHandlers(io, socket);
});

export { server, io, app };