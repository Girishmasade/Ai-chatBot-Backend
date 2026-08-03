import mongoose, { Schema } from "mongoose";
import type { IAIRequest } from "./aiRequest.interface.js";
import { AIRequestStatus, AIRequestPriority } from "./aiRequest.type.js";
import { AIService } from "../service-config/service-config.types.js";
import { ProviderName } from "../Provider/provider-config.types.js";

const aiRequestSchema = new Schema<IAIRequest>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    service: {
      type: String,
      enum: Object.values(AIService),
      required: true,
    },
    provider: {
      type: String,
      enum: Object.values(ProviderName),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(AIRequestStatus),
      default: AIRequestStatus.PENDING,
    },
    priority: {
      type: String,
      enum: Object.values(AIRequestPriority),
      default: AIRequestPriority.NORMAL,
    },
    prompt: {
      type: String,
      required: true,
      trim: true,
    },
    response: {
      type: String,
      trim: true,
    },
    tokenCost: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    transactionId: {
      type: Schema.Types.ObjectId,
      ref: "TokenTransaction",
    },
    model: {
      type: String,
      trim: true,
    },
    latencyMs: {
      type: Number,
      min: 0,
    },
    errorMessage: {
      type: String,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    ip: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Query indexes
aiRequestSchema.index({ user: 1, createdAt: -1 });           // user's request history
aiRequestSchema.index({ user: 1, service: 1 });              // user + service filter
aiRequestSchema.index({ status: 1 });                        // admin: filter by status
aiRequestSchema.index({ service: 1, provider: 1 });          // analytics per service/provider
aiRequestSchema.index({ createdAt: -1 });                    // admin: recent-first listing

export const AIRequestModel = mongoose.model<IAIRequest>(
  "AIRequest",
  aiRequestSchema
);