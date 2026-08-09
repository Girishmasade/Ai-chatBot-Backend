// notification.validator.ts

import { z } from "zod";

export const notificationTypes = [
  "system",
  "admin",
  "chat",
  "rag",
  "auth",
  "payment",            
] as const;

export const notificationPriority = ["low", "medium", "high"] as const;

export type NotificationType     = (typeof notificationTypes)[number];
export type NotificationPriority = (typeof notificationPriority)[number];

export const sendNotificationSchema = z.object({
  user:     z.string().trim().min(1, "User ID is required"),
  type:     z.enum(notificationTypes).default("admin"),
  priority: z.enum(notificationPriority).default("low"),
  title:    z.string().trim().min(1, "Title is required"),
  message:  z.string().trim().min(1, "Message is required"),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const broadcastNotificationSchema = z.object({
  type:     z.enum(notificationTypes).default("system"),
  priority: z.enum(notificationPriority).default("low"),
  title:    z.string().trim().min(1, "Title is required"),
  message:  z.string().trim().min(1, "Message is required"),
});

export const getNotificationsSchema = z.object({
  page:   z.string().default("1").transform(Number),  
  limit:  z.string().default("20").transform(Number),  
  type:   z.enum(notificationTypes).optional(),
  isRead: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export type SendNotificationInput      = z.infer<typeof sendNotificationSchema>;
export type BroadcastNotificationInput = z.infer<typeof broadcastNotificationSchema>;
export type GetNotificationsInput      = z.infer<typeof getNotificationsSchema>;