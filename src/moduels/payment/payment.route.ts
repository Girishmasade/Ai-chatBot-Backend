import { Router } from "express";
import { authMiddleware } from "@/middlewares/auth.middleware.js";
import { validate } from "@/middlewares/zod.middleware.js";
import { createOrder, verifyPayment, paymentWebhook } from "./payment.controller.js";
import { createOrderSchema, verifyPaymentSchema } from "./payment.validation.js";
import express from "express";

export const paymentRouter = Router();

// Secure user endpoints
paymentRouter.post(
  "/create-order",
  authMiddleware,
  validate(createOrderSchema),
  createOrder
);

paymentRouter.post(
  "/verify",
  authMiddleware,
  validate(verifyPaymentSchema),
  verifyPayment
);

// Webhook endpoint (must not be parsed by our standard JSON middleware if it alters raw body, 
// but Razorpay webhook verification works with standard JSON bodies as long as stringify is identical.
// However, it's safer to use it as is if body-parser hasn't mutated it).
paymentRouter.post(
  "/webhook",
  express.json(),
  paymentWebhook
);
