import mongoose, { Schema, type Document } from "mongoose";
import type { NotificationType, NotificationPriority } from "./notification.validator.js";

export interface INotification extends Document {       
  _id:      mongoose.Types.ObjectId;
  user:     mongoose.Types.ObjectId;                  
  type:     NotificationType;                         
  priority: NotificationPriority;                       
  title:    string;                                   
  message:  string;                                     
  isRead:   boolean;                                  
  readAt?:  Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    user: {
      type:     Schema.Types.ObjectId,
      ref:      "Auth",
      required: true,
    },
    title: {
      type:     String,
      required: true,
      trim:     true,
    },
    type: {
      type:    String,
      enum:    ["system", "admin", "chat", "rag", "auth", "payment"], 
      default: "system",
    },
    priority: {
      type:    String,
      enum:    ["low", "medium", "high"],
      default: "low",
    },
    message: {
      type:     String,
      required: true,
      trim:     true,
    },
    isRead: {
      type:    Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  { timestamps: true },
);

notificationSchema.index({ user: 1, createdAt: -1 }); // fetch notifications fast
notificationSchema.index({ user: 1, isRead: 1 });      // unread count fast
notificationSchema.index({ type: 1 });                 // filter by type fast

export const NotificationModel = mongoose.model<INotification>("Notification", notificationSchema,);