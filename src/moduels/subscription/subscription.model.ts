import {
  Currency,
  ServiceType,
  SubscriptionPlanType,
} from "@/shared/shared.types.enum.js";
import mongoose, { Schema, Document } from "mongoose";

export interface ISubscriptionPlan extends Document {
  name: string;
  plan: SubscriptionPlanType;
  price: number;
  currency: Currency;
  description: string;
  tokens: number;
  durationInDays: number;
  services: ServiceType[];
  rolloverEnabled: boolean;
  rolloverCapPercent: number;
  rolloverExpiryCycles: number;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
}

const subscriptionPlanSchema = new Schema<ISubscriptionPlan>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    plan: {
      type: String,
      enum: Object.values(SubscriptionPlanType),
      required: true,
    },
    currency: {
      type: String,
      enum: Object.values(Currency),
      required: true,
      default: Currency.USD,
    },
    price: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    tokens: {
      type: Number,
      required: true,
      min: 0,
    },
    durationInDays: {
      type: Number,
      required: true,
      min: 1,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    services: {
      type: [String],
      enum: Object.values(ServiceType), // prevents "chat" vs "CHAT" drift
      default: [],
    },
    rolloverEnabled: {
      type: Boolean,
      default: true,
    },
    rolloverCapPercent: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
    },
    rolloverExpiryCycles: {
      type: Number,
      default: 1,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Auth",
      required: true,
    },
  },
  { timestamps: true },
);

subscriptionPlanSchema.index({ plan: 1, isActive: 1 });

export const SubscriptionPlanModel = mongoose.model<ISubscriptionPlan>(
  "SubscriptionPlan",
  subscriptionPlanSchema,
);
