import { z } from "zod";
import { PaymentItemType } from "./payment.model.js";

// Validates the request to create a new Razorpay order
export const createOrderSchema = z.object({
  body: z.object({
    itemType: z.enum([PaymentItemType.SUBSCRIPTION, PaymentItemType.TOKEN_PACKAGE], {
      message: "Item type is required",
    }),
    itemId: z.string({ message: "Item ID is required" }).min(24, "Invalid ID"),
  }),
});

// Validates the request sent by the frontend after a successful payment
export const verifyPaymentSchema = z.object({
  body: z.object({
    razorpay_order_id: z.string({ message: "Order ID is required" }),
    razorpay_payment_id: z.string({ message: "Payment ID is required" }),
    razorpay_signature: z.string({ message: "Signature is required" }),
  }),
});

