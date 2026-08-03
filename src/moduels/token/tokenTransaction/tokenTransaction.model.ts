import mongoose, { Schema, Types } from "mongoose";
import type { ITokenTransactionDocument } from "./tokenTransaction.interface.js";
import {
  TransactionSource,
  TransactionStatus,
  TransactionType,
} from "./tokenTransaction.types.js";

const TokenTransactionSchema = new Schema<ITokenTransactionDocument>(
  {
    userId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(TransactionType),
      required: true,
    },
    source: {
      type: String,
      enum: Object.values(TransactionSource),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(TransactionStatus),
      default: TransactionStatus.PENDING,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    balanceBefore: {
      type: Number,
      required: true,
      min: 0,
    },
    balanceAfter: {
      type: Number,
      required: true,
      min: 0,
    },
    refTransactionId: {
      type: Schema.Types.ObjectId,
      ref: "TokenTransaction",
      index: true,
    },
    packageId: {
      type: Schema.Types.ObjectId,
      ref: "TokenPackage",
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "Subscription",
    },
    aiRequestId: {
      type: Schema.Types.ObjectId,
      ref: "AIRequest",
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },

    // ── Actor ────────────────────────────────────────────────────────────────
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    ipAddress: {
      type: String,
      trim: true,
    },
  },

  { timestamps: true, collection: "token_transactions" },
);

TokenTransactionSchema.index({ userId: 1, createdAt: -1 }); // user history
TokenTransactionSchema.index({ userId: 1, type: 1, createdAt: -1 }); // filtered user history
TokenTransactionSchema.index({ status: 1, createdAt: -1 }); // admin: PENDING/FAILED queue
TokenTransactionSchema.index({ type: 1, createdAt: -1 }); // platform analytics by type
TokenTransactionSchema.index({ type: 1, source: 1, createdAt: -1 });

export const TokenTransaction = mongoose.model<ITokenTransactionDocument>(
  "TokenTransaction",
  TokenTransactionSchema,
);
