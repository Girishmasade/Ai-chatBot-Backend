/**
 * Socket.IO emitter helpers.
 *
 * Import these functions from ANY module (controllers, workers, services)
 * to push real-time updates to connected clients without touching `io` directly.
 *
 * Usage:
 *   import { emitWalletUpdate, emitNotification } from "@/socket/socket.emitter.js";
 *
 *   // After wallet balance change:
 *   emitWalletUpdate(userId, { balance: 150, totalConsumed: 50, ... });
 *
 *   // After subscription activation:
 *   emitSubscriptionUpdate(userId, { planName: "Pro", status: "active", ... });
 */

import type { Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  SocketNotification,
  SocketWalletUpdate,
  SocketSubscriptionUpdate,
  SocketChatMessage,
  SocketTypingPayload,
} from "./socket.types.js";

// Re-export from handler so callers don't need two imports
export { getOnlineUsers, isUserOnline } from "./socket.handler.js";

type AppServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

// ── Internal reference ──────────────────────────────────────────────────────
// Set once from socket.ts after the Server is created.
let _io: AppServer | null = null;

/**
 * Must be called once during server bootstrap (from socket.ts).
 */
export function setIO(io: AppServer): void {
  _io = io;
}

function getIO(): AppServer {
  if (!_io) {
    throw new Error(
      "[Socket Emitter] io is not initialised — call setIO() first.",
    );
  }
  return _io;
}

// Generic helpers

/**
 * Emit an event to a specific user (all their connected tabs/devices).
 */
export function emitToUser<E extends keyof ServerToClientEvents>(
  userId: string,
  event: E,
  ...args: Parameters<ServerToClientEvents[E]>
): void {
  getIO().to(`user:${userId}`).emit(event, ...args);
}

/**
 * Broadcast an event to ALL connected clients.
 */
export function emitToAll<E extends keyof ServerToClientEvents>(
  event: E,
  ...args: Parameters<ServerToClientEvents[E]>
): void {
  getIO().emit(event, ...args);
}

// Notification helpers

/**
 * Push a new notification to a specific user.
 */
export function emitNotification(
  userId: string,
  notification: SocketNotification,
): void {
  emitToUser(userId, "notification:new", notification);
}

/**
 * Update the unread notification count for a user.
 */
export function emitNotificationCount(
  userId: string,
  unreadCount: number,
): void {
  emitToUser(userId, "notification:count", { unreadCount });
}

// Token Wallet helpers

/**
 * Push a wallet balance update to a user.
 * Call this after any balance mutation (purchase, consumption, refund, adjustment, bonus).
 */
export function emitWalletUpdate(
  userId: string,
  data: SocketWalletUpdate,
): void {
  emitToUser(userId, "wallet:updated", data);
}

// Subscription helpers

/**
 * Push a subscription status update to a user.
 * Call this after activation, renewal, cancellation, or expiry.
 */
export function emitSubscriptionUpdate(
  userId: string,
  data: SocketSubscriptionUpdate,
): void {
  emitToUser(userId, "subscription:updated", data);
}

// Chat helpers

/**
 * Push a chat message to a specific user.
 */
export function emitChatMessage(
  userId: string,
  message: SocketChatMessage,
): void {
  emitToUser(userId, "chat:message", message);
}

/**
 * Push a typing indicator to a specific user.
 */
export function emitTypingIndicator(
  userId: string,
  data: SocketTypingPayload,
): void {
  emitToUser(userId, "chat:typing", data);
}

// Admin helpers

/**
 * Emit a real-time audit log stream to connected admin clients.
 */
export function emitAdminLog(log: import("./socket.types.js").SocketAuditLog): void {
  // Assuming all admins are listening to global emit or we could use an "admin" room
  emitToAll("admin:log_stream", log);
}

/**
 * Emit an entity update (user/model/subscription) to the admin dashboard.
 */
export function emitAdminEntityUpdate(payload: import("./socket.types.js").SocketAdminUpdatePayload): void {
  emitToAll("admin:entity_update", payload);
}
