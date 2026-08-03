/**
 * Socket.IO event handler registration.
 *
 * Called once per authenticated connection to:
 *  - Join the socket to a personal room `user:<userId>`
 *  - Track the user in the online-users map
 *  - Register client→server event listeners
 *  - Handle disconnect / cleanup
 */

import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "./socket.types.js";

type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

type AppServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

// ── Online user tracking ────────────────────────────────────────────────────
// Maps userId → Set<socketId> (one user can have multiple tabs/devices).
const onlineUsers = new Map<string, Set<string>>();

export const getOnlineUsers = (): Set<string> => new Set(onlineUsers.keys());
export const isUserOnline = (userId: string): boolean => onlineUsers.has(userId);

// ── Handler registration ────────────────────────────────────────────────────

export function registerSocketHandlers(io: AppServer, socket: AppSocket): void {
  const { userId, username } = socket.data.user;

  // ── Join personal room ──────────────────────────────────────────────────
  const userRoom = `user:${userId}`;
  socket.join(userRoom);

  // ── Track online status ─────────────────────────────────────────────────
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
    // First tab → broadcast "online" to others
    socket.broadcast.emit("user:online", { userId });
  }
  onlineUsers.get(userId)!.add(socket.id);

  console.log(
    `[Socket] User connected — ${username} (${userId}) | socket=${socket.id} | tabs=${onlineUsers.get(userId)!.size}`,
  );

  // ── Client → Server: Chat ──────────────────────────────────────────────
  socket.on("chat:send", (data) => {
    // Placeholder: route to chat controller / AI pipeline later
    console.log(`[Socket] chat:send from ${userId}:`, data.conversationId);
  });

  socket.on("chat:typing", (data) => {
    // Broadcast typing to the conversation room (future: room per conversation)
    socket.broadcast.emit("chat:typing", {
      userId,
      conversationId: data.conversationId,
      isTyping: data.isTyping,
    });
  });

  // ── Client → Server: Notification ───────────────────────────────────────
  socket.on("notification:read", (data) => {
    // Placeholder: update in DB via notification controller
    console.log(`[Socket] notification:read from ${userId}:`, data.notificationId);
  });

  // ── Disconnect ──────────────────────────────────────────────────────────
  socket.on("disconnect", (reason) => {
    const sockets = onlineUsers.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        onlineUsers.delete(userId);
        // Last tab closed → broadcast "offline"
        socket.broadcast.emit("user:offline", { userId });
      }
    }

    console.log(
      `[Socket] User disconnected — ${username} (${userId}) | reason=${reason} | remaining tabs=${sockets?.size ?? 0}`,
    );
  });
}
