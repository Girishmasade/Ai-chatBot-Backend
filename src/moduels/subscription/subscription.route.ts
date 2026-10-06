import { authMiddleware, isAdmin } from "@/middlewares/auth.middleware.js";
import { Router } from "express";
import { createSubscription, deleteSubscriptionForUser, getSubscriptionForUser, updateSubscriptionForUser } from "./subscription.controller.js";
import { validate } from "@/middlewares/zod.middleware.js";
import { cancelUserSubscription, createSub, updateSub } from "./subscription.validator.js";
import {
  cancelSubscription,
  createUserSubscription,
  getMySubscription,
  getSubscription,
} from "./userSubscription.controller.js";

export const subscriptionRouter = Router();

subscriptionRouter.post(
  "/create-subscription",
  authMiddleware,
  isAdmin,
  validate(createSub),
  createSubscription,
);

subscriptionRouter.get(
  "/get-subscription",
  authMiddleware,
  isAdmin,
  getSubscriptionForUser,
);

subscriptionRouter.put(
  "/update-subscription/:subId",
  authMiddleware,
  isAdmin,
  updateSubscriptionForUser,
);

subscriptionRouter.delete(
  "/delete-subscription/:subId",
  authMiddleware,
  isAdmin,
  deleteSubscriptionForUser,
);

// ── Public: any authenticated user can view active plans ──────────────
subscriptionRouter.get(
  "/get-plans",
  authMiddleware,
  getSubscriptionForUser,
);

// ── Authenticated user active subscription & plan status ─────────────
subscriptionRouter.get(
  "/my-subscription",
  authMiddleware,
  getMySubscription,
);

subscriptionRouter.get(
  "/get-my-subscription",
  authMiddleware,
  getMySubscription,
);

// user subscription

subscriptionRouter.post(
  "/create-user-subscription/:planId",
  authMiddleware,
  createUserSubscription,
);

subscriptionRouter.get(
  "/get-user-subscription/:subscriptionId",
  authMiddleware,
  getSubscription,
);

subscriptionRouter.put(
  "/cancel-user-subscription/:subscriptionId",
  authMiddleware,
  validate(cancelUserSubscription),
  cancelSubscription,
);

