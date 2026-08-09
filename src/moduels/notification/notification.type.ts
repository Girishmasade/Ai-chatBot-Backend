import type { z } from "zod";
import type {
  sendNotificationSchema,
  broadcastNotificationSchema,
  getNotificationsSchema,
  notificationTypes,
  notificationPriority,
} from "./notification.validator.js";

export type NotificationType     = (typeof notificationTypes)[number];
export type NotificationPriority = (typeof notificationPriority)[number];

export type SendNotificationInput      = z.infer<typeof sendNotificationSchema>;
export type BroadcastNotificationInput = z.infer<typeof broadcastNotificationSchema>;
export type GetNotificationsInput      = z.infer<typeof getNotificationsSchema>;

export interface BaseNotificationPayload {
  userId:    string;
  title:     string;
  message:   string;
  type:      NotificationType;
  priority?: NotificationPriority;
  metadata?: Record<string, any>;
}

export interface SystemNotificationPayload
  extends Omit<BaseNotificationPayload, "type"> {
  type: "system";
}

export interface AdminNotificationPayload
  extends Omit<BaseNotificationPayload, "type"> {
  type: "admin";
}

export interface BroadcastPayload {
  title:     string;
  message:   string;
  type:      NotificationType;
  priority?: NotificationPriority;
}

export interface AuthNotificationPayload
  extends Omit<BaseNotificationPayload, "type"> {
  type: "auth";
  metadata?: {
    ip?:        string;
    userAgent?: string;
    device?:    string;
    location?:  string;
    timestamp?: Date;
  };
}

export interface RagNotificationPayload
  extends Omit<BaseNotificationPayload, "type"> {
  type: "rag";
  metadata?: {
    documentId?:   string;
    documentName?: string;
    chunkCount?:   number;
    reason?:       string;   // for failed notifications
  };
}

export interface AgentNotificationPayload
  extends Omit<BaseNotificationPayload, "type"> {
  type: "chat";
  metadata?: {
    taskId?:     string;
    taskName?:   string;
    agentType?:  "rag" | "langgraph" | "langchain";
    summary?:    string;
    reason?:     string;     // for failed notifications
    duration?:   number;     // how long agent ran in ms
    toolsUsed?:  string[];   // which tools the agent used
  };
}

export interface PaymentNotificationPayload
  extends Omit<BaseNotificationPayload, "type"> {
  type: "payment";
  metadata?: {
    amount?:        number;
    currency?:      string;
    transactionId?: string;
    status?:        "success" | "failed" | "pending";
    plan?:          string;
  };
}

export type NotificationPayload =
  | SystemNotificationPayload
  | AdminNotificationPayload
  | AuthNotificationPayload
  | RagNotificationPayload
  | AgentNotificationPayload
  | PaymentNotificationPayload;

export interface NotificationResponse {
  _id:       string;
  user:      string;
  type:      NotificationType;
  priority:  NotificationPriority;
  title:     string;
  message:   string;
  isRead:    boolean;
  readAt?:   Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

