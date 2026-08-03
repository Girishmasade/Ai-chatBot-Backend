import mongoose, { Schema } from "mongoose";
import type { ITokenDocument } from "./token.interface.js";
import { TokenPackageCurrency, TokenPackageStatus } from "./token.type.js";

const TokenPackageSchema = new Schema<ITokenDocument>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    tokenAmount: {
      type: Number,
      required: true,
      min: 1,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      enum: Object.values(TokenPackageCurrency),
      default: TokenPackageCurrency.INR,
    },
    status: {
      type: String,
      enum: Object.values(TokenPackageStatus),
      default: TokenPackageStatus.ACTIVE,
    },
    isPopular: {
      type: Boolean,
      default: false,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Query indexes
TokenPackageSchema.index({ status: 1 });
TokenPackageSchema.index({ sortOrder: 1 });
TokenPackageSchema.index({ isPopular: 1 });
TokenPackageSchema.index({ status: 1, sortOrder: 1 }); // compound — default listing sort

export const TokenPackage = mongoose.model<ITokenDocument>(
  "TokenPackage",
  TokenPackageSchema
);