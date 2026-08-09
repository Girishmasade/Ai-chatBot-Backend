import type { Document, Types } from "mongoose";
import type { WalletStatus } from "./tokenWallet.types.js";

export interface ITokenWallet {
  userId: Types.ObjectId;
 
  // Current spendable balance — never goes below 0
  balance: number;
 
  // Lifetime aggregate stats — denormalized for fast dashboard reads
  totalPurchased: number;
  totalConsumed: number;
  totalRefunded: number;
  totalBonus: number;
  totalAdjusted: number; // net of all ADJUSTMENT transactions (can be negative)
  totalPlanCredit: number;
 
  // Wallet health
  status: WalletStatus;
  frozenReason?: string;
  frozenAt?: Date;
  frozenBy?: Types.ObjectId; // admin userId
 
  // Useful for activity queries without hitting TokenTransaction
  lastTransactionAt?: Date;
 
  createdAt: Date;
  updatedAt: Date;
}

export interface ITokenWalletDocument extends ITokenWallet, Document {}

export interface IFreezeWalletPayload {
  userId: string;
  reason: string;
  adminId: string;
  ipAddress?: string;
}
 
export interface IUnfreezeWalletPayload {
  userId: string;
  adminId: string;
  ipAddress?: string;
}

export interface IWalletPublicView {
  userId: string;
  balance: number;
  totalPurchased: number;
  totalConsumed: number;
  totalRefunded: number;
  totalBonus: number;
  totalPlanCredit: number;
  status: WalletStatus;
  lastTransactionAt?: Date;
  createdAt: Date;
}
 
export interface IWalletAdminView extends IWalletPublicView {
  totalAdjusted: number;
  frozenReason?: string;
  frozenAt?: Date;
  frozenBy?: string;
}