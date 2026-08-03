import mongoose from "mongoose";
import { UserSubscriptionModel } from "./userSubscription.model.js";
import { SubscriptionPlanModel } from "./subscription.model.js";
import TokenWalletModel from "../token/tokenWallet/tokenWallet.model.js";
import {
  TransactionType,
  TransactionSource,
  TransactionStatus,
} from "../token/tokenTransaction/tokenTransaction.types.js";
import {
  UserSubscriptionStatus,
  SubscriptionPlanType,
  Currency,
  ServiceType,
} from "@/shared/shared.types.enum.js";
import { calculateSubscriptionEndDate } from "./subscription.utils.js";
import { TokenTransaction } from "../token/tokenTransaction/tokenTransaction.model.js";
import { AuthModel } from "../auth/auth.models.js";

export interface IAssignPlanResult {
  userSubscription: InstanceType<typeof UserSubscriptionModel>;
  tokensCredited: number;
}

export async function assignPlanToUser(
  userId: string,
  planId: string,
  session: mongoose.ClientSession,
): Promise<IAssignPlanResult> {
  const plan = await SubscriptionPlanModel.findById(planId).session(session);
  if (!plan) {
    throw new Error(`Subscription plan not found: ${planId}`);
  }
  if (!plan.isActive) {
    throw new Error(`Subscription plan "${plan.name}" is not active`);
  }

  // One active subscription per user, not per plan — mirrors the existing
  // guard in createUserSubscription. Re-checked here so this function is
  // safe to call standalone, not just from a context that already checked.
  const existingActive = await UserSubscriptionModel.findOne({
    user: userId,
    status: UserSubscriptionStatus.ACTIVE,
  }).session(session);

  if (existingActive) {
    return {
      userSubscription: existingActive,
      tokensCredited: 0, // no double-credit
    };
  }

  const startDate = new Date();
  const endDate = calculateSubscriptionEndDate(startDate, plan.durationInDays);

  const [userSubscription] = await UserSubscriptionModel.create(
    [
      {
        user: userId,
        plan: plan._id,
        status: UserSubscriptionStatus.ACTIVE,
        startDate,
        endDate,
        paymentRef: null,
        activatedAt: startDate,
      },
    ],
    { session },
  );

  // ── Credit wallet with this plan's token allotment ──────────────────────────
  // Inlined rather than calling tokenTransaction.controller's `credit()`
  // helper, because that helper opens its OWN session via withOptionalSession
  // — nesting sessions would break atomicity with the UserSubscription write
  // above. This block intentionally duplicates credit()'s logic using the
  // CALLER'S session instead.
  const wallet = await TokenWalletModel.findOne({ userId }).session(session);
  if (!wallet) {
    throw new Error(
      `Wallet not found for user ${userId}. initWallet() must run before plan assignment.`,
    );
  }

  const tokensToCredit = plan.tokens;
  const balanceBefore = wallet.balance ?? 0;
  const balanceAfter = balanceBefore + tokensToCredit;

  await TokenTransaction.create(
    [
      {
        userId,
        type: TransactionType.PLAN_CREDIT,
        source: TransactionSource.SYSTEM,
        status: TransactionStatus.COMPLETED,
        amount: tokensToCredit,
        balanceBefore,
        balanceAfter,
        subscriptionId: userSubscription._id,
        description: `Plan credit — ${plan.name}`,
      },
    ],
    { session },
  );

  await TokenWalletModel.findOneAndUpdate(
    { userId },
    {
      $set: { balance: balanceAfter, lastTransactionAt: new Date() },
      $inc: { totalPlanCredit: tokensToCredit },
    },
    { session, returnDocument: "after" }, //  replaces `new: true`
  );

  return { userSubscription, tokensCredited: tokensToCredit };
}

// getFreePlanId()
//
// Resolves the "Free" plan's ObjectId by name lookup. Centralized here so
// the magic string "Free" exists in exactly one place. If your seed data
// uses a different field (e.g. an enum `plan: "FREE"` rather than
// `name: "Free"`), this is the only line that needs to change.

export async function getFreePlanId(
  session?: mongoose.ClientSession,
): Promise<string> {
  const query = SubscriptionPlanModel.findOne({ name: "Free", isActive: true });
  let freePlan = session ? await query.session(session) : await query;

  if (!freePlan) {
    try {
      // Find an admin user or any user to set as the creator of the seeded plan.
      // If no user exists yet, use a default placeholder ObjectId.
      const creator = await AuthModel.findOne({ role: "admin" }).session(
        session || null,
      );
      const creatorId = creator
        ? creator._id
        : new mongoose.Types.ObjectId("000000000000000000000000");

      const [seededPlan] = await SubscriptionPlanModel.create(
        [
          {
            name: "Free",
            plan: SubscriptionPlanType.FREE,
            price: 0,
            currency: Currency.USD,
            description: "Default Free Subscription Plan",
            tokens: 200, // 200 fresh signup bonus tokens
            durationInDays: 30, // 30 days duration
            services: [ServiceType.CHAT],
            rolloverEnabled: false,
            rolloverCapPercent: 0,
            rolloverExpiryCycles: 0,
            isActive: true,
            createdBy: creatorId,
          },
        ],
        { session },
      );
      freePlan = seededPlan;
      console.log('Successfully auto-seeded default "Free" subscription plan.');
    } catch (seedError) {
      console.error("Failed to auto-seed default Free plan:", seedError);
      throw new Error(
        'No active "Free" subscription plan found, and auto-seeding failed. Please seed one manually.',
      );
    }
  }

  return freePlan._id.toString();
}
