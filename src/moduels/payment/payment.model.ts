import mongoose, { Schema, type Document } from "mongoose";

export enum PaymentStatus {
  PENDING = "PENDING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
}

export enum PaymentItemType {
  SUBSCRIPTION = "SUBSCRIPTION",
  TOKEN_PACKAGE = "TOKEN_PACKAGE",
}

export interface IPaymentTransaction extends Document {
  user: mongoose.Types.ObjectId;
  orderId: string;       // Razorpay order_id
  paymentId?: string;    // Razorpay payment_id (populated on success)
  signature?: string;    // Razorpay signature (populated on success)
  amount: number;        // in paise (e.g. 10000 = ₹100)
  currency: string;
  status: PaymentStatus;
  itemType: PaymentItemType;
  itemId: mongoose.Types.ObjectId; // Reference to SubscriptionPlan or TokenPackage
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const paymentTransactionSchema = new Schema<IPaymentTransaction>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "Auth",
      required: true,
      index: true,
    },
    orderId: {
      type: String,
      required: true,
      unique: true,
    },
    paymentId: {
      type: String,
    },
    signature: {
      type: String,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "INR",
    },
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
      index: true,
    },
    itemType: {
      type: String,
      enum: Object.values(PaymentItemType),
      required: true,
    },
    itemId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    errorMessage: {
      type: String,
    },
  },
  { timestamps: true }
);

export const PaymentTransactionModel = mongoose.model<IPaymentTransaction>(
  "PaymentTransaction",
  paymentTransactionSchema
);
