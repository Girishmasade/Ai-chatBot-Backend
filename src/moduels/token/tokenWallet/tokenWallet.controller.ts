import mongoose from "mongoose";
import type {
  ITokenWalletDocument,
  IWalletAdminView,
  IWalletPublicView,
} from "./tokenWallet.interface.js";
import { AsyncHandler } from "@/utils/AsyncHandler.js";
import type { AuthUser } from "@/moduels/auth/auth.payload.js";
import { errorHandler } from "@/utils/errorHandler.util.js";
import TokenWalletModel from "./tokenWallet.model.js";
import { successHandler } from "@/utils/successHandler.util.js";
import { WalletStatus } from "./tokenWallet.types.js";
import { paginate, parsePaginationParams } from "@/helper/pagination.helper.js";
import { TokenTransaction } from "../tokenTransaction/tokenTransaction.model.js";

// NOTE ON ARCHITECTURE:
// Business logic (balance math, freeze rules, ledger reconciliation) lives
// directly in this controller — there is no separate service layer in this
// module, matching the SubscriptionPlan controller's convention. The
// `withOptionalSession` helper is exported at the bottom so
// tokenTransaction.controller.ts can reuse the same atomic-transaction
// wrapper without duplicating it.

/**
 * Runs a mutation inside a MongoDB session/transaction when replica-set
 * support is available, and degrades gracefully to a plain (non-atomic)
 * execution on a single-node MongoDB instance. Atlas is replica-set by
 * default, so this only matters for local dev without one configured.
 */

async function withOptionalSession<T>(
  fn: (session: mongoose.ClientSession | null) => Promise<T>,
): Promise<T> {
  let session: mongoose.ClientSession | null = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    if (session) await session.abortTransaction();
    throw err;
  } finally {
    if (session) session.endSession();
  }
}

/** Strip admin-only fields before returning wallet data to a normal user. */

function toPublicView(wallet: ITokenWalletDocument): IWalletPublicView {
  return {
    userId: wallet.userId.toString(),
    balance: wallet.balance,
    totalPurchased: wallet.totalPurchased,
    totalConsumed: wallet.totalConsumed,
    totalRefunded: wallet.totalRefunded,
    totalBonus: wallet.totalBonus,
    totalPlanCredit: wallet.totalPlanCredit,
    status: wallet.status,
    lastTransactionAt: wallet.lastTransactionAt,
    createdAt: wallet.createdAt,
  };
}

/** Full wallet view for the admin panel — includes freeze metadata + adjustment totals. */

function toAdminView(wallet: ITokenWalletDocument): IWalletAdminView {
  return {
    ...toPublicView(wallet),
    totalAdjusted: wallet.totalAdjusted,
    frozenReason: wallet.frozenReason,
    frozenAt: wallet.frozenAt,
    frozenBy: wallet.frozenBy?.toString(),
  };
}

/**
 * Pure reconciliation function used only by recalculateBalance below.
 * Given a list of COMPLETED transactions, computes what the wallet
 * balance should be from scratch.
 */

function computeExpectedBalance(
  transactions: { type: string; amount: number }[],
): number {
  const CREDIT_TYPES = new Set([
    "PURCHASE",
    "REFUND",
    "REVERSAL",
    "BONUS",
    "PLAN_CREDIT",
  ]);
  let balance = 0;

  for (const txn of transactions) {
    if (CREDIT_TYPES.has(txn.type)) {
      balance += Math.abs(txn.amount);
    } else if (txn.type === "ADJUSTMENT") {
      balance += txn.amount;
    } else {
      balance -= Math.abs(txn.amount);
    }
  }

  return Math.max(0, balance);
}

/**
 * Called once during user registration. Idempotent — safe to call again.
 *   await initWallet(newUser._id.toString());
 */

export async function initWallet(
  userId: string,
  session?: mongoose.ClientSession,
): Promise<ITokenWalletDocument> {
  const query = TokenWalletModel.findOne({ userId });
  const existing = session ? await query.session(session) : await query;
  if (existing) return existing;

  if (session) {
    const [created] = await TokenWalletModel.create([{ userId, balance: 200, totalBonus: 200 }], { session });
    return created;
  }
  return TokenWalletModel.create({ userId, balance: 200, totalBonus: 200 });
}

/**
 * Throws a descriptive Error if the wallet is frozen or underfunded.
 * Call before dispatching any AI provider request:
 *   await validateSufficientBalance(userId, estimatedCost);
 */
export async function validateSufficientBalance(
  userId: string,
  required: number,
): Promise<void> {
  let wallet = await TokenWalletModel.findOne(
    { userId },
    { balance: 1, status: 1, frozenReason: 1 },
  );
  if (!wallet) {
    wallet = await initWallet(userId);
  }

  if (wallet.status === WalletStatus.FROZEN) {
    throw new Error(
      `Your account has been suspended. Please contact support. (${wallet.frozenReason ?? ""})`,
    );
  }
  if (wallet.balance < required) {
    throw new Error(
      `Insufficient tokens. This request requires ${required} tokens but you only have ${wallet.balance}.`,
    );
  }
}

// user wallet data

export const getUserWalletBalance = AsyncHandler(async (req, res, next) => {
  try {
    const userId = (req.user as AuthUser).id;

    if (!userId) {
      return errorHandler(res, 401, false, "User not authenticated", {});
    }

    let wallet = await TokenWalletModel.findOne({ userId });

    if (!wallet) {
      wallet = await initWallet(userId);
    }

    console.log("get my wallet :", wallet);

    return successHandler(res, 200, true, "wallet Fetched successfully", {
      wallet: toPublicView(wallet),
    });
  } catch (error) {
    console.log("error in user wallet balance :", error);
    next();
  }
});

// admin

export const getWalletByUserId = AsyncHandler(async (req, res, next) => {
  try {
    const userId = req.params.userId;

    if (!userId) {
      return errorHandler(res, 400, false, "userId not found", {});
    }

    const wallet = await TokenWalletModel.findOne({ userId });

    console.log("admin get wallet :", wallet);

    if (!wallet) {
      return errorHandler(res, 404, false, "Wallet not found", {});
    }

    return successHandler(res, 200, true, "Wallet Fetched Successfully", {
      wallet: toAdminView(wallet),
    });
  } catch (error) {
    console.log("error to get wallet by userId :", error);
    next(error);
  }
});

// Admin: list all wallets (paginated, optional status filter)

export const listOfAllWallets = AsyncHandler(async (req, res, next) => {
  try {
    const {
      status,
      page = 1,
      limit = 20,
    } = req.query as {
      status?: WalletStatus;
      page?: number;
      limit?: number;
    };

    const query: Record<string, unknown> = {};

    if (status) query.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const total = await TokenWalletModel.countDocuments(query);
    const wallets = await TokenWalletModel.find(query)
      .sort({ balance: -1 })
      .skip(skip)
      .limit(Number(limit));

    console.log("admin list wallets count :", wallets.length);

    return successHandler(res, 200, true, "Wallets Fetched Successfully", {
      wallets: wallets.map(toAdminView),
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
     console.log("error to get list of wallet :", error);
    next(error);
  }
});

// Admin: freeze a wallet

 
export const freezeWallet = AsyncHandler(async (req, res, next) => {
  try {
    const AdminId = (req.user as AuthUser).id;
    const userId = req.params.userId;
    const { reason } = req.body as { reason: string };
 
    if (!AdminId) {
      return errorHandler(res, 401, false, "Admin not found", {});
    }
    if (!userId) {
      return errorHandler(res, 400, false, "userId not found", {});
    }
    if (!reason) {
      return errorHandler(res, 400, false, "Freeze reason is required", {});
    }
 
    const wallet = await TokenWalletModel.findOne({ userId });
    if (!wallet) {
      return errorHandler(res, 404, false, "Wallet not found", {});
    }
 
    if (wallet.status === WalletStatus.FROZEN) {
      return errorHandler(res, 409, false, "Wallet is already frozen", {});
    }
 
    wallet.status = WalletStatus.FROZEN;
    wallet.frozenReason = reason;
    wallet.frozenAt = new Date();
    wallet.frozenBy = new mongoose.Types.ObjectId(AdminId);
 
    const frozenWallet = await wallet.save();
 
    console.log("freeze wallet :", frozenWallet);
 
    // if (!frozenWallet) {
    //   return errorHandler(res, 400, false, "Wallet not frozen", {});
    // }
 
    // TODO: AuditLog entry — action: 'FREEZE_WALLET', module: 'TokenWallet',
    // targetId: userId, previousData: { status: 'ACTIVE' }, newData: { status: 'FROZEN', reason }
 
    return successHandler(res, 200, true, "Wallet Frozen Successfully", {
      wallet: toAdminView(frozenWallet),
    });
  } catch (error) {
    console.log("error to freeze wallet :", error);
    next(error);
  }
});
 
// Admin: unfreeze a wallet

export const unfreezeWallet = AsyncHandler(async (req, res, next) => {
  try {
    const AdminId = (req.user as AuthUser).id;
    const userId = req.params.userId;
 
    if (!AdminId) {
      return errorHandler(res, 401, false, "Admin not found", {});
    }
    if (!userId) {
      return errorHandler(res, 400, false, "userId not found", {});
    }
 
    const wallet = await TokenWalletModel.findOne({ userId });
    if (!wallet) {
      return errorHandler(res, 404, false, "Wallet not found", {});
    }
 
    if (wallet.status === WalletStatus.ACTIVE) {
      return errorHandler(res, 409, false, "Wallet is already active", {});
    }
 
    wallet.status = WalletStatus.ACTIVE;
    wallet.frozenReason = undefined;
    wallet.frozenAt = undefined;
    wallet.frozenBy = undefined;
 
    const unfrozenWallet = await wallet.save();
 
    console.log("unfreeze wallet :", unfrozenWallet);
 
    // TODO: AuditLog entry — action: 'UNFREEZE_WALLET', module: 'TokenWallet'
 
    return successHandler(res, 200, true, "Wallet Unfrozen Successfully", {
      wallet: toAdminView(unfrozenWallet),
    });
  } catch (error) {
    console.log("error to unfreeze wallet :", error);
    next(error);
  }
});
 
// Admin: recalculate balance (ledger-repair tool)
 
export const recalculateBalance = AsyncHandler(async (req, res, next) => {
  try {
    const userId = req.params.userId;
 
    if (!userId) {
      return errorHandler(res, 400, false, "userId not found", {});
    }
 
    const wallet = await TokenWalletModel.findOne({ userId });
    if (!wallet) {
      return errorHandler(res, 404, false, "Wallet not found", {});
    }
 
    const transactions = await TokenTransaction.find(
      { userId, status: "COMPLETED" },
      { type: 1, amount: 1 },
    ).lean();
 
    const expected = computeExpectedBalance(transactions);
    const actual = wallet.balance;
    const corrected = expected !== actual;
 
    if (corrected) {
      wallet.balance = expected;
      await wallet.save();
    }
 
    console.log("recalculate balance :", { expected, actual, corrected });
 
    const message = corrected
      ? `Balance corrected from ${actual} to ${expected}`
      : "Balance is consistent — no correction needed";
 
    return successHandler(res, 200, true, message, {
      expected,
      actual,
      corrected,
    });
  } catch (error) {
    console.log("error to recalculate balance :", error);
    next(error);
  }
});

// Exported for reuse by tokenTransaction.controller.ts
export { withOptionalSession };
