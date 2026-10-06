import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IRefreshToken extends Document {
  userId: Types.ObjectId;
  token: string;
  accessToken?: string;
  expiresAt: Date;
  deviceInfo?: string;
  ipAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "Auth",
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    accessToken: {
      type: String,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // MongoDB TTL index to auto-remove expired documents
    },
    deviceInfo: {
      type: String,
      default: "Browser",
    },
    ipAddress: {
      type: String,
    },
  },
  { timestamps: true }
);

export const RefreshTokenModel = mongoose.model<IRefreshToken>(
  "RefreshToken",
  refreshTokenSchema
);
