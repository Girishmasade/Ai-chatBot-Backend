import { UserSubscriptionStatus } from "@/shared/shared.types.enum.js";
import mongoose, { Schema, Document } from "mongoose";

export interface IUserSubscription extends Document {
  user: mongoose.Types.ObjectId;
  plan: mongoose.Types.ObjectId;                          
  status: UserSubscriptionStatus
  startDate: Date;
  endDate: Date | null;
  paymentRef: mongoose.Types.ObjectId | null;
  activatedAt: Date | null;
  cancelledAt: Date | null;
}

const userSubscriptionSchema = new Schema<IUserSubscription>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "Auth",
      required: true,
    },
    plan: {
      type: Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      required: true,
    },
    status: {
      type: String,
      enum:Object.values(UserSubscriptionStatus),
      default: UserSubscriptionStatus.INACTIVE
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      default: null,
    },
    paymentRef: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },
    activatedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// "Does this user have an active subscription?" — checked on subscribe, and on every AI request later.
userSubscriptionSchema.index({ user: 1, status: 1 });

// BullMQ renewal job's primary query: "which active subscriptions are due for renewal/expiry today?"
userSubscriptionSchema.index({ status: 1, endDate: 1 });

export const UserSubscriptionModel = mongoose.model<IUserSubscription>(
  "UserSubscription",
  userSubscriptionSchema,
);
