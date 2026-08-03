import mongoose from "mongoose";
import { AsyncHandler } from "@/utils/AsyncHandler.js";
import { errorHandler } from "@/utils/errorHandler.util.js";
import { successHandler } from "@/utils/successHandler.util.js";
import { WalletStatus } from "../tokenWallet/tokenWallet.types.js";
import { withOptionalSession } from "../tokenWallet/tokenWallet.controller.js";
import {
  TransactionType,
  TransactionSource,
  TransactionStatus,
  CREDIT_TYPES,
} from "./tokenTransaction.types.js";
import type { AuthUser } from "@/moduels/auth/auth.payload.js";
import { TokenTransaction } from "./tokenTransaction.model.js";
import TokenWalletModel from "../tokenWallet/tokenWallet.model.js";

// NOTE ON ARCHITECTURE:
// Credit/debit/adjust/reverse logic lives directly in this controller — no
// separate service layer, matching tokenWallet.controller.ts and the
// SubscriptionPlan controller's convention. `withOptionalSession` is
// imported from tokenWallet.controller.ts rather than duplicated, since
// both modules always write a wallet + a transaction together atomically.
//
// REUSE NOTE: `debit` and `credit` near the bottom are plain exported
// functions, not Express handlers — they exist so the future AIRequest
// module can call them in-process:
//   await debit({ userId, amount, aiRequestId });

// User: get own transaction history

export const getMyTransactions = AsyncHandler(async (req, res, next) => {
  try {
    const userId = (req.user as AuthUser).id;

    if (!userId) {
      return errorHandler(res, 401, false, "User not authenticated", {});
    }

    const {
      type,
      status,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = req.query as Record<string, string | number>;

    const query: Record<string, unknown> = { userId };
    if (type) query.type = type;
    if (status) query.status = status;
    if (dateFrom || dateTo) {
      query.createdAt = {
        ...(dateFrom ? { $gte: new Date(dateFrom as string) } : {}),
        ...(dateTo ? { $lte: new Date(dateTo as string) } : {}),
      };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await TokenTransaction.countDocuments(query);
    const transactions = await TokenTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    console.log("get my transactions count :", transactions.length);

    return successHandler(res, 200, true, "Transactions Fetched Successfully", {
      transactions,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    console.log("error to get my transactions :", error);
    next(error);
  }
});

// Admin: list all transactions (platform-wide, filterable)

export const listAllTransactions = AsyncHandler(async (req, res, next) => {
  try {
    const {
      userId,
      type,
      source,
      status,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = req.query as Record<string, string | number>;

    const query: Record<string, unknown> = {};
    if (userId) query.userId = userId;
    if (type) query.type = type;
    if (source) query.source = source;
    if (status) query.status = status;
    if (dateFrom || dateTo) {
      query.createdAt = {
        ...(dateFrom ? { $gte: new Date(dateFrom as string) } : {}),
        ...(dateTo ? { $lte: new Date(dateTo as string) } : {}),
      };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await TokenTransaction.countDocuments(query);
    const transactions = await TokenTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    console.log("admin list all transactions count :", transactions.length);

    return successHandler(res, 200, true, "Transactions Fetched Successfully", {
      transactions,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    console.log("error to list all transactions :", error);
    next(error);
  }
});

// Admin: get a specific user's transaction history

export const getUserTransactions = AsyncHandler(async (req, res, next) => {
  try {
    const userId = req.params.userId as string;

    if (!userId) {
      return errorHandler(res, 400, false, "userId not found", {});
    }

    const {
      type,
      source,
      status,
      page = 1,
      limit = 20,
    } = req.query as Record<string, string | number>;

    const query: Record<string, unknown> = { userId };
    if (type) query.type = type;
    if (source) query.source = source;
    if (status) query.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const total = await TokenTransaction.countDocuments(query);
    const transactions = await TokenTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    console.log("admin get user transactions count :", transactions.length);

    return successHandler(res, 200, true, "Transactions Fetched Successfully", {
      transactions,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    console.log("error to get user transactions :", error);
    next(error);
  }
});

// Get a single transaction by ID

export const getTransactionById = AsyncHandler(async (req, res, next) => {
  try {
    const transactionId = req.params.transactionId as string;

    if (!transactionId) {
      return errorHandler(res, 400, false, "transactionId not found", {});
    }

    const transaction = await TokenTransaction.findById(transactionId);

    console.log("get transaction by id :", transaction);

    if (!transaction) {
      return errorHandler(res, 404, false, "Transaction not found", {});
    }

    return successHandler(res, 200, true, "Transaction Fetched Successfully", {
      transaction,
    });
  } catch (error) {
    console.log("error to get transaction by id :", error);
    next(error);
  }
});

// Admin: grant bonus tokens

export const grantBonus = AsyncHandler(async (req, res, next) => {
  try {
    const AdminId = (req.user as AuthUser).id;
    const userId = req.params.userId as string;
    const { amount, description } = req.body as {
      amount: number;
      description?: string;
    };

    if (!AdminId) {
      return errorHandler(res, 401, false, "Admin not found", {});
    }
    if (!userId) {
      return errorHandler(res, 400, false, "userId not found", {});
    }
    if (amount === undefined || amount <= 0) {
      return errorHandler(res, 400, false, "A positive amount is required", {});
    }

    const wallet = await TokenWalletModel.findOne({ userId });
    if (!wallet) {
      return errorHandler(res, 404, false, "Wallet not found", {});
    }

    const transaction = await withOptionalSession(async (session) => {
      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore + amount;

      const [txn] = await TokenTransaction.create(
        [
          {
            userId: new mongoose.Types.ObjectId(userId),
            type: TransactionType.BONUS,
            source: TransactionSource.ADMIN,
            status: TransactionStatus.COMPLETED,
            amount,
            balanceBefore,
            balanceAfter,
            description: description ?? "Bonus granted by admin",
            performedBy: new mongoose.Types.ObjectId(AdminId),
            ipAddress: req.ip,
          },
        ],
        { session },
      );

      await TokenWalletModel.findOneAndUpdate(
        { userId },
        {
          $set: { balance: balanceAfter, lastTransactionAt: new Date() },
          $inc: { totalBonus: amount },
        },
        { session },
      );

      return txn;
    });

    console.log("grant bonus :", transaction);

    if (!transaction) {
      return errorHandler(res, 400, false, "Bonus not granted", {});
    }

    // TODO: AuditLog entry — action: 'GRANT_BONUS_TOKENS', module: 'TokenTransaction',
    // targetId: userId, newData: { amount, description }

    return successHandler(
      res,
      201,
      true,
      `${amount} bonus tokens granted successfully`,
      { transaction },
    );
  } catch (error) {
    console.log("error to grant bonus :", error);
    next(error);
  }
});

// Admin: manually adjust a user's balance (positive = credit, negative = debit)

export const adjustBalance = AsyncHandler(async (req, res, next) => {
  try {
    const AdminId = (req.user as AuthUser).id;
    const userId = req.params.userId as string;
    const { amount, reason } = req.body as { amount: number; reason: string };

    if (!AdminId) {
      return errorHandler(res, 401, false, "Admin not found", {});
    }
    if (!userId) {
      return errorHandler(res, 400, false, "userId not found", {});
    }
    if (amount === undefined || amount === 0) {
      return errorHandler(res, 400, false, "A non-zero amount is required", {});
    }
    if (!reason) {
      return errorHandler(
        res,
        400,
        false,
        "A reason is required for balance adjustments",
        {},
      );
    }

    const wallet = await TokenWalletModel.findOne({ userId });
    if (!wallet) {
      return errorHandler(res, 404, false, "Wallet not found", {});
    }

    const proposedBalance = wallet.balance + amount;
    if (proposedBalance < 0) {
      return errorHandler(
        res,
        409,
        false,
        `Adjustment of ${amount} would result in a negative balance (current: ${wallet.balance})`,
        {},
      );
    }

    const transaction = await withOptionalSession(async (session) => {
      const balanceBefore = wallet.balance;
      const balanceAfter = proposedBalance;

      const [txn] = await TokenTransaction.create(
        [
          {
            userId: new mongoose.Types.ObjectId(userId),
            type: TransactionType.ADJUSTMENT,
            source: TransactionSource.ADMIN,
            status: TransactionStatus.COMPLETED,
            amount,
            balanceBefore,
            balanceAfter,
            description: reason,
            performedBy: new mongoose.Types.ObjectId(AdminId),
            ipAddress: req.ip,
          },
        ],
        { session },
      );

      await TokenWalletModel.findOneAndUpdate(
        { userId },
        {
          $set: { balance: balanceAfter, lastTransactionAt: new Date() },
          $inc: { totalAdjusted: amount },
        },
        { session },
      );

      return txn;
    });

    console.log("adjust balance :", transaction);

    const direction = amount > 0 ? "credited" : "debited";

    // TODO: AuditLog entry — action: 'ADJUST_BALANCE', module: 'TokenTransaction',
    // previousData: { balance: wallet.balance }, newData: { balance: proposedBalance, reason }

    return successHandler(
      res,
      201,
      true,
      `Balance ${direction} by ${Math.abs(amount)} tokens`,
      { transaction },
    );
  } catch (error) {
    console.log("error to adjust balance :", error);
    next(error);
  }
});

// Admin: reverse a completed CONSUMPTION transaction

export const reverseTransaction = AsyncHandler(async (req, res, next) => {
  try {
    const AdminId = (req.user as AuthUser).id;
    const transactionId = req.params.transactionId as string;
    const { reason } = req.body as { reason: string };

    if (!AdminId) {
      return errorHandler(res, 401, false, "Admin not found", {});
    }
    if (!transactionId) {
      return errorHandler(res, 400, false, "transactionId not found", {});
    }
    if (!reason) {
      return errorHandler(
        res,
        400,
        false,
        "A reason is required to reverse a transaction",
        {},
      );
    }

    const original = await TokenTransaction.findById(transactionId);
    if (!original) {
      return errorHandler(res, 404, false, "Original transaction not found", {});
    }
    if (original.status === TransactionStatus.REVERSED) {
      return errorHandler(
        res,
        409,
        false,
        "This transaction has already been reversed",
        {},
      );
    }
    if (original.status !== TransactionStatus.COMPLETED) {
      return errorHandler(
        res,
        409,
        false,
        `Only COMPLETED transactions can be reversed (current: ${original.status})`,
        {},
      );
    }
    if (original.type !== TransactionType.CONSUMPTION) {
      return errorHandler(
        res,
        409,
        false,
        "Only CONSUMPTION transactions can be reversed via this endpoint",
        {},
      );
    }

    const wallet = await TokenWalletModel.findOne({ userId: original.userId });
    if (!wallet) {
      return errorHandler(res, 404, false, "Wallet not found", {});
    }

    const reversalTxn = await withOptionalSession(async (session) => {
      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore + original.amount;

      const [reversal] = await TokenTransaction.create(
        [
          {
            userId: original.userId,
            type: TransactionType.REVERSAL,
            source: TransactionSource.ADMIN,
            status: TransactionStatus.COMPLETED,
            amount: original.amount,
            balanceBefore,
            balanceAfter,
            refTransactionId: original._id,
            aiRequestId: original.aiRequestId,
            description: reason,
            performedBy: new mongoose.Types.ObjectId(AdminId),
            ipAddress: req.ip,
          },
        ],
        { session },
      );

      await TokenTransaction.findByIdAndUpdate(
        transactionId,
        { $set: { status: TransactionStatus.REVERSED } },
        { session },
      );

      await TokenWalletModel.findOneAndUpdate(
        { userId: original.userId },
        {
          $set: { balance: balanceAfter, lastTransactionAt: new Date() },
          $inc: { totalRefunded: original.amount },
        },
        { session },
      );

      return reversal;
    });

    console.log("reverse transaction :", reversalTxn);

    // TODO: AuditLog entry — action: 'REVERSE_TRANSACTION', module: 'TokenTransaction',
    // targetId: original.userId, previousData: { status: 'COMPLETED' }, newData: { status: 'REVERSED' }

    return successHandler(res, 201, true, "Transaction reversed successfully", {
      transaction: reversalTxn,
    });
  } catch (error) {
    console.log("error to reverse transaction :", error);
    next(error);
  }
});

/**
 * Deducts tokens after a successful AI provider call.
 *   await debit({ userId, amount, aiRequestId });
 * Throws if the wallet is frozen or the balance is insufficient.
 */
export async function debit(params: {
  userId: string;
  amount: number;
  aiRequestId?: string;
  description?: string;
}) {
  const { userId, amount, aiRequestId, description } = params;
  if (amount <= 0) throw new Error("Debit amount must be a positive integer");

  return withOptionalSession(async (session) => {
    const wallet = await TokenWalletModel.findOne({ userId }).session(session);
    if (!wallet) throw new Error(`Wallet not found for user ${userId}`);

    if (wallet.status === WalletStatus.FROZEN) {
      throw new Error(
        `Wallet is frozen and cannot process transactions. Reason: ${wallet.frozenReason ?? "No reason provided"}`,
      );
    }
    if (wallet.balance < amount) {
      throw new Error(
        `Insufficient balance. Required: ${amount}, Available: ${wallet.balance}`,
      );
    }

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore - amount;

    const [txn] = await TokenTransaction.create(
      [
        {
          userId: new mongoose.Types.ObjectId(userId),
          type: TransactionType.CONSUMPTION,
          source: TransactionSource.AI_REQUEST,
          status: TransactionStatus.COMPLETED,
          amount,
          balanceBefore,
          balanceAfter,
          aiRequestId: aiRequestId ? new mongoose.Types.ObjectId(aiRequestId) : undefined,
          description,
        },
      ],
      { session },
    );

    await TokenWalletModel.findOneAndUpdate(
      { userId },
      {
        $set: { balance: balanceAfter, lastTransactionAt: new Date() },
        $inc: { totalConsumed: amount },
      },
      { session },
    );

    return txn;
  });
}

/**
 * Credits tokens to a wallet (PURCHASE, REFUND, REVERSAL, BONUS, PLAN_CREDIT).
 *   await credit({ userId, amount, type: TransactionType.PLAN_CREDIT, source: TransactionSource.SYSTEM });
 */
export async function credit(params: {
  userId: string;
  amount: number;
  type: TransactionType;
  source: TransactionSource;
  description?: string;
  packageId?: string;
  subscriptionId?: string;
}) {
  const { userId, amount, type, source, description, packageId, subscriptionId } =
    params;

  if (!CREDIT_TYPES.has(type)) {
    throw new Error(`Transaction type "${type}" is not a credit operation`);
  }
  if (amount <= 0) throw new Error("Credit amount must be a positive integer");

  return withOptionalSession(async (session) => {
    const wallet = await TokenWalletModel.findOne({ userId }).session(session);
    if (!wallet) throw new Error(`Wallet not found for user ${userId}`);

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + amount;

    const statFieldMap: Partial<Record<TransactionType, string>> = {
      [TransactionType.PURCHASE]: "totalPurchased",
      [TransactionType.REFUND]: "totalRefunded",
      [TransactionType.REVERSAL]: "totalRefunded",
      [TransactionType.BONUS]: "totalBonus",
      [TransactionType.PLAN_CREDIT]: "totalPlanCredit",
    };
    const statField = statFieldMap[type];

    const [txn] = await TokenTransaction.create(
      [
        {
          userId: new mongoose.Types.ObjectId(userId),
          type,
          source,
          status: TransactionStatus.COMPLETED,
          amount,
          balanceBefore,
          balanceAfter,
          packageId: packageId ? new mongoose.Types.ObjectId(packageId) : undefined,
          subscriptionId: subscriptionId ? new mongoose.Types.ObjectId(subscriptionId) : undefined,
          description,
        },
      ],
      { session },
    );

    await TokenWalletModel.findOneAndUpdate(
      { userId },
      {
        $set: { balance: balanceAfter, lastTransactionAt: new Date() },
        $inc: statField ? { [statField]: amount } : {},
      },
      { session },
    );

    return txn;
  });
}