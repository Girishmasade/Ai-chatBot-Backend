import { Router } from 'express';
import {
  getMyTransactions,
  listAllTransactions,
  getUserTransactions,
  getTransactionById,
  grantBonus,
  adjustBalance,
  reverseTransaction,
} from './tokenTransaction.controller.js';
import {
  transactionHistorySchema,
  getTransactionByIdSchema,
  adjustBalanceSchema,
  grantBonusSchema,
  reverseTransactionSchema,
} from './tokenTransaction.validation.js';
import { authMiddleware, isAdmin } from '@/middlewares/auth.middleware.js';
import { validate } from '@/middlewares/zod.middleware.js';

const userTransactionRouter  = Router();
const adminTransactionRouter = Router();

// ── User routes ───────────────────────────────────────────────────────────────

userTransactionRouter.use(authMiddleware);

userTransactionRouter.get(
  '/me',
  validate(transactionHistorySchema),
  getMyTransactions,
);
userTransactionRouter.get(
  '/:transactionId',
  validate(getTransactionByIdSchema),
  getTransactionById,
);

// ── Admin routes ──────────────────────────────────────────────────────────────

adminTransactionRouter.use(authMiddleware, isAdmin);

adminTransactionRouter.get(
  '/all',
  validate(transactionHistorySchema),
  listAllTransactions,
);
adminTransactionRouter.get(
  '/user/:userId',
  validate(transactionHistorySchema),
  getUserTransactions,
);
adminTransactionRouter.post(
  '/user/:userId/bonus',
  validate(grantBonusSchema),
  grantBonus,
);
adminTransactionRouter.post(
  '/user/:userId/adjust',
  validate(adjustBalanceSchema),
  adjustBalance,
);
adminTransactionRouter.post(
  '/:transactionId/reverse',
  validate(reverseTransactionSchema),
  reverseTransaction,
);

export { userTransactionRouter, adminTransactionRouter };