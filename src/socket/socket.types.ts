/**
 * Socket.IO typed event maps.
 *
 * Using these generics with `Server<ClientToServerEvents, ServerToClientEvents>`
 * gives full type-safety on both emit and listener sides.
 */

// Payload Interfaces

export interface SocketNotification {
  _id?: string;
  id?: string;
  type?: string;
  priority?: string;
  title: string;
  message: string;
  isRead?: boolean;
  metadata?: Record<string, any>;
  createdAt?: string;
}

export interface SocketWalletUpdate {
  balance: number;
  totalConsumed?: number;
  totalPurchased?: number;
  totalBonus?: number;
  totalPlanCredit?: number;
  status?: string;
  reason?: string;
}

export interface SocketSubscriptionUpdate {
  planName: string;
  status: string;
  startDate: string;
  endDate: string | null;
  tokens: number;
}

export interface SocketChatMessage {
  messageId: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface SocketTypingPayload {
  userId: string;
  conversationId?: string;
  isTyping: boolean;
}

export interface SocketAuditLog {
  id: string;
  action: string;
  operator: string;
  timestamp: string;
  details: string;
  level?: string;
}

export interface SocketAdminUpdatePayload {
  entityType: "user" | "model" | "subscription" | "config" | "menu";
  action: "created" | "updated" | "deleted";
  data: any;
}

// Server → Client events

export interface ServerToClientEvents {
  // Notifications
  "notification:new": (notification: SocketNotification) => void;
  "notification:count": (data: { unreadCount: number }) => void;

  // Token wallet
  "wallet:updated": (data: SocketWalletUpdate) => void;

  // Subscription
  "subscription:updated": (data: SocketSubscriptionUpdate) => void;

  // Chat
  "chat:message": (message: SocketChatMessage) => void;
  "chat:typing": (data: SocketTypingPayload) => void;

  // Presence
  "user:online": (data: { userId: string }) => void;
  "user:offline": (data: { userId: string }) => void;

  // Admin Dashboard
  "admin:log_stream": (log: SocketAuditLog) => void;
  "admin:entity_update": (payload: SocketAdminUpdatePayload) => void;
}

// Client → Server events

export interface ClientToServerEvents {
  "chat:send": (data: { message: string; conversationId: string }) => void;
  "chat:typing": (data: { conversationId: string; isTyping: boolean }) => void;
  "notification:read": (data: { notificationId: string }) => void;
}

// Inter-server events (unused for now, required by generics)

export interface InterServerEvents {
  ping: () => void;
}

// Per-socket data (attached after auth)

export interface SocketData {
  user: {
    userId: string;
    role: string;
    email: string;
    username: string;
  };
}
