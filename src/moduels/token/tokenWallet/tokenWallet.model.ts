import { model, Schema, Types } from "mongoose";
import type { ITokenWalletDocument } from "./tokenWallet.interface.js";
import { WalletStatus } from "./tokenWallet.types.js";

const TokenWalletSchema = new Schema<ITokenWalletDocument>(
  {
    userId: {
      type: Types.ObjectId,
      ref: "User",
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Wallet balance cannot be negative"],
    },

    totalPurchased: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Wallet balance cannot be negative"],
    },

    totalRefunded: { type: Number, default: 0, min: 0 },

    totalConsumed: { type: Number, default: 0, min: 0 },

    totalBonus: { type: Number, default: 0, min: 0 },

    totalAdjusted: { type: Number, default: 0 },

    totalPlanCredit: { type: Number, default: 0, min: 0 },

    status: {
      type: String,
      enum: Object.values(WalletStatus),
      default: WalletStatus.ACTIVE,
      index: true,
    },

    frozenReason: { type: String, trim: true },

    frozenAt: { type: Date },

    frozenBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    lastTransactionAt: { type: Date },
  },
  { timestamps: true, collection: "token_wallet" },
);

TokenWalletSchema.index({ balance: -1 });               // admin: sort by balance
TokenWalletSchema.index({ lastTransactionAt: -1 });      // admin: recently active wallets
TokenWalletSchema.index({ status: 1, balance: -1 });     // admin: frozen wallets with balance

const TokenWalletModel = model<ITokenWalletDocument>('TokenWallet', TokenWalletSchema);
export default TokenWalletModel;