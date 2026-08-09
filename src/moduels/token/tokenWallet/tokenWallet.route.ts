import { Router } from "express";
import {
  getUserWalletBalance,
  getWalletByUserId,
  listOfAllWallets,
  freezeWallet,
  unfreezeWallet,
  recalculateBalance,
} from "./tokenWallet.controller.js";
import {
  freezeWalletSchema,
  unfreezeWalletSchema,
  recalculateBalanceSchema,
  listWalletsSchema,
  getWalletByUserIdSchema,
} from "./tokenWallet.validation.js";
import { authMiddleware, isAdmin } from "@/middlewares/auth.middleware.js";
import { validate } from "@/middlewares/zod.middleware.js";

const userWalletRouter = Router();
const adminWalletRouter = Router();

// ── User routes ───────────────────────────────────────────────────────────────

userWalletRouter.use(authMiddleware);
userWalletRouter.get("/:userId", getUserWalletBalance);

// ── Admin routes ──────────────────────────────────────────────────────────────

adminWalletRouter.use(authMiddleware, isAdmin);

adminWalletRouter.get("/wallets", validate(listWalletsSchema), listOfAllWallets);  // exact match first
adminWalletRouter.get("/:userId", validate(getWalletByUserIdSchema), getWalletByUserId); // wildcard last // at postman tessting is worked done

adminWalletRouter.patch(
  "/:userId/freeze",
  validate(freezeWalletSchema),
  freezeWallet,
);

adminWalletRouter.patch(
  "/:userId/unfreeze",
  validate(unfreezeWalletSchema),
  unfreezeWallet,
);

adminWalletRouter.post(
  "/:userId/recalculate",
  validate(recalculateBalanceSchema),
  recalculateBalance,
);

export { userWalletRouter, adminWalletRouter };
