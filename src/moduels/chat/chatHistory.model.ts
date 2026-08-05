import mongoose, { Schema, Document, Types } from "mongoose";

export interface IChatMessage {
  _id?: Types.ObjectId;
  role: "user" | "assistant" | "system";
  content: string;
  model?: string;
  provider?: string;
  fileUrl?: string;
  fileName?: string;
  timestamp: Date;
}

export interface IChatSession extends Document {
  userId: Types.ObjectId;
  title: string;
  service: string;
  messages: IChatMessage[];
  lastModel?: string;
  createdAt: Date;
  updatedAt: Date;
}

const chatMessageSchema = new Schema<IChatMessage>(
  {
    role: { type: String, enum: ["user", "assistant", "system"], required: true },
    content: { type: String, required: true },
    model: { type: String },
    provider: { type: String },
    fileUrl: { type: String },
    fileName: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: true }
);

const chatSessionSchema = new Schema<IChatSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "Auth", required: true, index: true },
    title: { type: String, required: true, trim: true, default: "New Conversation" },
    service: { type: String, default: "ai_chat" },
    messages: [chatMessageSchema],
    lastModel: { type: String },
  },
  { timestamps: true }
);

chatSessionSchema.index({ userId: 1, updatedAt: -1 });

export const ChatSessionModel = mongoose.model<IChatSession>("ChatSession", chatSessionSchema);
