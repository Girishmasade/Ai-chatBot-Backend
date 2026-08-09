import type { Document, Types } from "mongoose";
import type {
  TransactionSource,
  TransactionStatus,
  TransactionType,
} from "./tokenTransaction.types.js";

export interface ITokenTransaction {
  userId: Types.ObjectId;
  type: TransactionType;
  source: TransactionSource;
  status: TransactionStatus;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  refTransactionId?: Types.ObjectId; // REFUND/REVERSAL → points at the original txn
  packageId?: Types.ObjectId; // PURCHASE → which TokenPackage was bought
  subscriptionId?: Types.ObjectId; // PLAN_CREDIT → which subscription granted this
  aiRequestId?: Types.ObjectId;
  description?: string;
  metadata?: Record<string, unknown>;
  performedBy?: Types.ObjectId; // admin userId, when source = ADMIN
  ipAddress?: string;
  createdAt: Date;
}

export interface ITokenTransactionDocument
  extends ITokenTransaction, Document {}

export interface ICreditPayload {
  userId: string;
  amount: number;
  type:
    | TransactionType.PURCHASE
    | TransactionType.REFUND
    | TransactionType.REVERSAL
    | TransactionType.BONUS
    | TransactionType.PLAN_CREDIT;
  source: TransactionSource;
  description?: string;
  packageId?: string;
  subscriptionId?: string;
  refTransactionId?: string;
  performedBy?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

export interface IDebitPayload {
  userId: string;
  amount: number;
  type: TransactionType.CONSUMPTION | TransactionType.EXPIRY;
  source: TransactionSource;
  description?: string;
  aiRequestId?: string;
  performedBy?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

export interface IAdjustPayload {
  userId: string;
  amount: number; // positive = add tokens, negative = remove tokens
  reason: string; // mandatory — stored as description for audit
  adminId: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

export interface IReverseTransactionPayload {
  originalTransactionId: string;
  reason: string;
  adminId: string;
  ipAddress?: string;
}

// Query / Filter Types

export interface ITransactionHistoryFilter {
  userId?: string;
  type?: TransactionType;
  source?: TransactionSource;
  status?: TransactionStatus;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}
