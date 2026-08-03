import mongoose from "mongoose";
import { AsyncHandler } from "@/utils/AsyncHandler.js";
import { createCacheHelper } from "@/utils/redis.util.js";
import { errorHandler } from "@/utils/errorHandler.util.js";
import { successHandler } from "@/utils/successHandler.util.js";
import { paginate, parsePaginationParams } from "@/helper/pagination.helper.js";
import {
  executeProviderRequest,
  estimateTotalTokens,
} from "./aiRequest.gateway.js";
import { AIRequestModel } from "./aiRequest.model.js";
import { AIRequestStatus, AIRequestPriority } from "./aiRequest.type.js";
import {
  AI_REQUEST_CACHE_NAMESPACE,
  AI_REQUEST_CACHE_TTL,
  AI_REQUEST_ALLOWED_SORT_FIELDS,
  AI_REQUEST_DEFAULT_SORT_BY,
  AI_REQUEST_DEFAULT_SORT_ORDER,
} from "./aiRequest.constant.js";
import { ServiceConfigModel } from "../service-config/service-config.model.js";
import { SystemModelModel } from "../admin/systemModel.model.js";
import { UserSubscriptionModel } from "../subscription/userSubscription.model.js";
import TokenWalletModel from "../token/tokenWallet/tokenWallet.model.js";
import { TokenTransaction } from "../token/tokenTransaction/tokenTransaction.model.js";
import {
  TransactionType,
  TransactionSource,
  TransactionStatus,
} from "../token/tokenTransaction/tokenTransaction.types.js";

// ─── Redis cache instance ─────────────────────────────────────────────────────

const aiRequestCache = createCacheHelper({
  namespace: AI_REQUEST_CACHE_NAMESPACE,
  ttl:       AI_REQUEST_CACHE_TTL,
});

// USER — Execute AI Request
// POST /api/v1/ai/execute

export const executeAIRequest = AsyncHandler(async (req, res, next) => {
  try {
    const userId    = req.user?.id;
    const ipAddress = req.ip;

    const {
      service,
      prompt,
      systemPrompt,
      conversationHistory,
      model,
      priority,
      parameters,
      metadata,
    } = req.body;

    console.log(`[AIRequest] Incoming ${service} request — userId: ${userId}`);

    if (!userId) {
      return errorHandler(res, 401, false, "Unauthorized", {});
    }

    // ── Step 1: Resolve Configuration (SystemModel + ServiceConfig fallback) ─────────────────────────────────────────
    
    // Map AIRequest service to SystemModel type
    const serviceToModelType: Record<string, string> = {
      ai_chat: "text",
      business_ideas: "text",
      prompt_gen: "text",
      image_gen: "image",
      asset_gen: "image",
      video_gen: "video",
    };
    const modelType = serviceToModelType[service] || "text";

    // Try finding an active system model for this service first
    const activeSystemModels = await SystemModelModel.find({ 
      type: modelType, 
      status: "active" 
    }).lean();

    let enabledProviders: any[] = [];
    let tokensPerUnit = 1;

    if (activeSystemModels && activeSystemModels.length > 0) {
      // Map SystemModels to the expected Provider format
      enabledProviders = activeSystemModels.map((sm, index) => ({
        provider: sm.provider.toLowerCase(),
        model: sm.version,
        priority: index + 1,
        enabled: true,
        maxTokens: undefined,
        temperature: undefined
      }));
      
      // Parse cost if available (e.g., "2 cr / query" -> 2)
      if (activeSystemModels[0].cost) {
        const parsedCost = parseFloat(activeSystemModels[0].cost);
        if (!isNaN(parsedCost)) {
          tokensPerUnit = parsedCost;
        }
      }
    } else {
      // Fallback to ServiceConfigModel if no SystemModel found
      const serviceConfig = await ServiceConfigModel.findOne({
        service,
        enabled: true,
      }).lean();

      if (!serviceConfig) {
        return errorHandler(
          res, 403, false,
          `The "${service}" service is currently disabled or not configured.`,
          {},
        );
      }

      enabledProviders = (serviceConfig.providers ?? [])
        .filter((p: any) => p.enabled)
        .sort((a: any, b: any) => a.priority - b.priority);
        
      tokensPerUnit = (serviceConfig as any).tokensPerUnit ?? 1;
    }

    if (!enabledProviders.length) {
      return errorHandler(
        res, 503, false,
        "No AI providers are currently available for this service. Please try again later.",
        {},
      );
    }

    // ── Step 2: Validate Active Subscription ──────────────────────────────────

    const subscription = await UserSubscriptionModel.findOne({
      user:   userId,
      status: "active",
    }).lean();

    if (!subscription) {
      return errorHandler(
        res, 403, false,
        "An active subscription is required to use AI services.",
        {},
      );
    }

    if (subscription.endDate && new Date(subscription.endDate) < new Date()) {
      return errorHandler(
        res, 403, false,
        "Your subscription has expired. Please renew to continue.",
        {},
      );
    }

    // ── Step 3: Check Token Balance ───────────────────────────────────────────
    // TokenWalletModel schema uses `userId` field, not `user`.

    const wallet = await TokenWalletModel.findOne({ userId });

    if (!wallet) {
      return errorHandler(res, 404, false, "Token wallet not found.", {});
    }

    const estimatedTokens = estimateTotalTokens(prompt, systemPrompt, conversationHistory);
    const estimatedCost = Math.ceil(estimatedTokens * tokensPerUnit);

    if (wallet.balance < estimatedCost) {
      return errorHandler(
        res, 402, false,
        `Insufficient tokens. Required: ~${estimatedCost}, Available: ${wallet.balance}.`,
        { required: estimatedCost, available: wallet.balance },
      );
    }

    // ── Step 4: Resolve initial provider ─────────────────────────────────────

    const initialProvider = enabledProviders[0];
    const resolvedModel: string = model ?? initialProvider.model ?? "default";

    // ── Step 5: Create PENDING Request Record ─────────────────────────────────

    const aiRequest = await AIRequestModel.create({
      user:      userId,
      service,
      provider:  initialProvider.provider,
      status:    AIRequestStatus.PENDING,
      priority:  priority ?? AIRequestPriority.NORMAL,
      prompt,
      model:     resolvedModel,
      tokenCost: 0,
      latencyMs: 0,
      ip:        ipAddress,
      metadata,
    });

    console.log(`[AIRequest] Created PENDING record: ${aiRequest._id}`);

    // ── Step 6: Reserve Tokens (Pre-deduction) ────────────────────────────────
    // Open ONE session and keep it open through Steps 6 → 9 → 10.
    // endSession() is called exactly once: either on an early-exit error path
    // (inside the catch below, or end of Step 9) or after Step 10 succeeds.

    const dbSession = await mongoose.startSession();
    let balanceBeforeReserve = 0;

    try {
      await dbSession.withTransaction(async () => {
        const walletLocked = await TokenWalletModel.findOne({ userId }).session(dbSession);

        if (!walletLocked) throw new Error("WALLET_NOT_FOUND");
        if (walletLocked.balance < estimatedCost) throw new Error("INSUFFICIENT_TOKENS");

        balanceBeforeReserve  = walletLocked.balance;
        walletLocked.balance -= estimatedCost;
        await walletLocked.save({ session: dbSession });

        // FIX: TokenTransactionSchema fields are: userId, type, source, status,
        //      amount, balanceBefore, balanceAfter, aiRequestId, metadata.
        //      There is NO `bucket` field and NO `user` field — use `userId`.
        //      `source` must be a TransactionSource enum value, not a TOKEN_SOURCE string.
        await TokenTransaction.create(
          [{
            userId,
            type:          TransactionType.CONSUMPTION,
            source:        TransactionSource.AI_REQUEST,
            status:        TransactionStatus.PENDING,
            amount:        estimatedCost,
            balanceBefore: balanceBeforeReserve,
            balanceAfter:  walletLocked.balance,
            aiRequestId:   aiRequest._id,
            metadata: {
              service,
              estimatedCost,
              reserveStatus: "RESERVED",
            },
          }],
          { session: dbSession },
        );
      });
    } catch (reserveErr: any) {
      await dbSession.endSession();

      const code =
        reserveErr.message === "INSUFFICIENT_TOKENS" ? "INSUFFICIENT_TOKENS"
        : reserveErr.message === "WALLET_NOT_FOUND"  ? "WALLET_NOT_FOUND"
        : "RESERVE_FAILED";

      await AIRequestModel.findByIdAndUpdate(aiRequest._id, {
        status:       AIRequestStatus.FAILED,
        errorMessage: reserveErr.message,
      });

      return errorHandler(
        res,
        code === "INSUFFICIENT_TOKENS" ? 402 : 500,
        false,
        code === "INSUFFICIENT_TOKENS"
          ? "Token balance changed during reservation. Please retry."
          : "Failed to reserve tokens. Please try again.",
        {},
      );
    }

    // ── Step 7: Mark PROCESSING ───────────────────────────────────────────────

    await AIRequestModel.findByIdAndUpdate(aiRequest._id, {
      status: AIRequestStatus.PROCESSING,
    });

    // ── Step 8: Execute Provider Call with Failover ───────────────────────────

    let providerResponse: any = null;
    let usedProvider: any     = null;
    let usedModel             = resolvedModel;
    let attemptNumber         = 0;

    for (const providerConfig of enabledProviders) {
      attemptNumber++;

      const currentModel =
        attemptNumber === 1
          ? (model ?? providerConfig.model)
          : providerConfig.model;

      console.log(
        `[AIRequest] Attempt ${attemptNumber} — provider: ${providerConfig.provider}, model: ${currentModel}`,
      );

      // The gateway resolves API keys by provider name from its own credential store.
      // FIX: pass empty string instead of null — gateway signature expects string.
      const result = await executeProviderRequest(
        providerConfig.provider,
        "",
        {
          model:               currentModel,
          prompt,
          systemPrompt,
          conversationHistory,
          parameters: {
            ...parameters,
            imageUrl: parameters?.imageUrl,
          },
          maxTokens:   providerConfig.maxTokens   ?? parameters?.maxTokens,
          temperature: providerConfig.temperature ?? parameters?.temperature,
        },
        service,
      );

      if (result.success) {
        providerResponse = result;
        usedProvider     = providerConfig;
        usedModel        = currentModel;
        break;
      }

      console.warn(
        `[AIRequest] Provider ${providerConfig.provider} failed on attempt ${attemptNumber}: ${result.error?.message}`,
      );
    }

    // ── Step 9: All Providers Failed → Release Reserve ────────────────────────
    // Reuse the existing dbSession — it is still open on this path.

    if (!providerResponse?.success) {
      await dbSession
        .withTransaction(async () => {
          const walletRestore = await TokenWalletModel.findOne({ userId }).session(dbSession);
          if (!walletRestore) return;

          const balanceBefore    = walletRestore.balance;
          walletRestore.balance += estimatedCost;
          await walletRestore.save({ session: dbSession });

          await TokenTransaction.create(
            [{
              userId,
              type:          TransactionType.REVERSAL,    // reverses the CONSUMPTION reserve
              source:        TransactionSource.SYSTEM,
              status:        TransactionStatus.COMPLETED,
              amount:        estimatedCost,
              balanceBefore,
              balanceAfter:  walletRestore.balance,
              aiRequestId:   aiRequest._id,
              metadata: {
                service,
                reason: "ALL_PROVIDERS_FAILED",
              },
            }],
            { session: dbSession },
          );
        })
        .catch((releaseErr) => {
          // CRITICAL: manual reconciliation required — do not surface to user
          console.error(
            `[AIRequest] CRITICAL — failed to release reserve for ${aiRequest._id}:`,
            releaseErr,
          );
        });

      await dbSession.endSession();

      await AIRequestModel.findByIdAndUpdate(aiRequest._id, {
        status:       AIRequestStatus.FAILED,
        provider:     usedProvider?.provider ?? enabledProviders[0]?.provider,
        errorMessage: providerResponse?.error?.message ?? "All providers failed to respond.",
      });

      return errorHandler(
        res, 503, false,
        "AI service is temporarily unavailable. Your tokens have been refunded. Please try again.",
        {},
      );
    }

    // ── Step 10: Reconcile Actual Token Cost ──────────────────────────────────
    // dbSession is still open — reuse it. Do NOT call startSession() again.

    const actualTokens = providerResponse.usage.totalTokens || estimatedTokens;
    const actualCost   = Math.ceil(actualTokens * tokensPerUnit);
    const delta        = estimatedCost - actualCost; // positive = overpaid

    await dbSession.withTransaction(async () => {
      const walletFinal = await TokenWalletModel.findOne({ userId }).session(dbSession);
      if (!walletFinal) throw new Error("Wallet missing during reconciliation");

      const balanceBefore = walletFinal.balance;

      if (delta > 0) {
        // Overpaid — refund the delta back to the wallet
        walletFinal.balance      += delta;
        walletFinal.totalConsumed = (walletFinal.totalConsumed ?? 0) + actualCost;
        await walletFinal.save({ session: dbSession });

        await TokenTransaction.create(
          [{
            userId,
            type:          TransactionType.REVERSAL,   // partial reversal of the reserve
            source:        TransactionSource.SYSTEM,
            status:        TransactionStatus.COMPLETED,
            amount:        delta,
            balanceBefore,
            balanceAfter:  walletFinal.balance,
            aiRequestId:   aiRequest._id,
            metadata:      { estimatedCost, actualCost, delta, reconcileReason: "OVERPAID" },
          }],
          { session: dbSession },
        );
      } else if (delta < 0) {
        // Underpaid — charge the shortfall if balance allows
        const shortfall = Math.abs(delta);

        if (walletFinal.balance >= shortfall) {
          walletFinal.balance      -= shortfall;
          walletFinal.totalConsumed = (walletFinal.totalConsumed ?? 0) + actualCost;
          await walletFinal.save({ session: dbSession });

          await TokenTransaction.create(
            [{
              userId,
              type:          TransactionType.CONSUMPTION,
              source:        TransactionSource.AI_REQUEST,
              status:        TransactionStatus.COMPLETED,
              amount:        shortfall,
              balanceBefore,
              balanceAfter:  walletFinal.balance,
              aiRequestId:   aiRequest._id,
              metadata:      { estimatedCost, actualCost, shortfall, reconcileReason: "UNDERPAID" },
            }],
            { session: dbSession },
          );
        } else {
          // Insufficient balance for shortfall — accept the loss, log for billing audit.
          console.warn(
            `[AIRequest] Shortfall of ${shortfall} tokens not recoverable for request ${aiRequest._id} — accepted as loss`,
          );
          walletFinal.totalConsumed = (walletFinal.totalConsumed ?? 0) + actualCost;
          await walletFinal.save({ session: dbSession });
        }
      } else {
        // Exact match — only update totalConsumed
        walletFinal.totalConsumed = (walletFinal.totalConsumed ?? 0) + actualCost;
        await walletFinal.save({ session: dbSession });
      }
    });

    // Session is fully done — close it once here
    await dbSession.endSession();

    // ── Step 11: Mark COMPLETED ───────────────────────────────────────────────

    await AIRequestModel.findByIdAndUpdate(
      aiRequest._id,
      {
        status:    AIRequestStatus.COMPLETED,
        provider:  usedProvider!.provider,
        model:     usedModel,
        response:  providerResponse.content,
        tokenCost: actualCost,
        latencyMs: providerResponse.latencyMs,
        metadata: {
          ...metadata,
          providerRequestId: providerResponse.providerRequestId,
          attemptNumber,
          promptTokens:      providerResponse.usage.promptTokens,
          completionTokens:  providerResponse.usage.completionTokens,
          totalTokens:       providerResponse.usage.totalTokens,
          tokensCharged:     actualCost,
          imageUrls:         providerResponse.imageUrls ?? [],
        },
      },
      { new: true },
    ).lean();

    // Notify Admin Real-Time of Service Usage (Privacy Safe: Service & Model only)
    try {
      const { emitAdminEntityUpdate } = await import("@/socket/socket.emitter.js");
      const { AuditLogModel } = await import("../admin/auditLog.model.js");

      const userEmail = (req.user as any)?.email || "User";
      const userUsername = (req.user as any)?.username || "User";

      await AuditLogModel.create({
        action: "AI Model Utilized",
        operator: userUsername,
        details: `User ${userEmail} used service '${service}' with model '${usedModel}' (${actualCost} cr)`,
        level: "info",
      });

      emitAdminEntityUpdate({
        entityType: "user",
        action: "updated",
        data: {
          id: userId,
          serviceUsed: service,
          modelUsed: usedModel,
        },
      });
    } catch (notifyErr) {
      console.error("Admin AI usage notification error:", notifyErr);
    }

    console.log(
      `[AIRequest] COMPLETED ${aiRequest._id} — provider: ${usedProvider!.provider}, ` +
      `tokens: ${actualTokens}, cost: ${actualCost}, latency: ${providerResponse.latencyMs}ms`,
    );

    // ── Step 12: Invalidate cache entry and respond ───────────────────────────

    await aiRequestCache.invalidate(String(aiRequest._id));

    return successHandler(res, 200, true, "AI request completed successfully.", {
      requestId:  aiRequest._id,
      service,
      response:   providerResponse.content,
      imageUrls:  providerResponse.imageUrls ?? [],
      provider:   usedProvider!.provider,
      model:      usedModel,
      tokenUsage: {
        promptTokens:     providerResponse.usage.promptTokens,
        completionTokens: providerResponse.usage.completionTokens,
        totalTokens:      providerResponse.usage.totalTokens,
        tokensCharged:    actualCost,
      },
      latencyMs: providerResponse.latencyMs,
    });
  } catch (error) {
    console.error("❌ Error in executeAIRequest:", error);
    next(error);
  }
});

// USER — Estimate Token Cost (pre-flight check)
// POST /api/v1/ai/estimate

export const estimateCost = AsyncHandler(async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { service, prompt, systemPrompt, conversationHistory } = req.body;

    console.log(`[AIRequest] estimateCost — userId: ${userId}, service: ${service}`);

    const serviceConfig = await ServiceConfigModel.findOne({
      service,
      enabled: true,
    }).lean();

    if (!serviceConfig) {
      return errorHandler(res, 403, false, `The "${service}" service is currently disabled.`, {});
    }

    const estimatedTokens = estimateTotalTokens(prompt, systemPrompt, conversationHistory);
    const tokensPerUnit: number = (serviceConfig as any).tokensPerUnit ?? 1;
    const estimatedCost = Math.ceil(estimatedTokens * tokensPerUnit);

    const wallet = await TokenWalletModel.findOne({ userId }).lean();
    const currentBalance = wallet?.balance ?? 0;

    return successHandler(res, 200, true, "Cost estimate calculated.", {
      estimatedTokens,
      estimatedCost,
      tokensPerUnit,
      currentBalance,
      canAfford: currentBalance >= estimatedCost,
      note: "This is an estimate. Actual cost is reconciled from the provider's response.",
    });
  } catch (error) {
    console.error("❌ Error in estimateCost:", error);
    next(error);
  }
});

// USER — Get Own Request History
// GET /api/v1/ai/my-requests

export const getMyAIRequests = AsyncHandler(async (req, res, next) => {
  try {
    const userId = req.user?.id;

    console.log(`[AIRequest] getMyAIRequests — userId: ${userId}`);

    if (!userId) {
      return errorHandler(res, 401, false, "Unauthorized", {});
    }

    const { service, status, priority, from, to } = req.query;

    const { page, limit, sort } = parsePaginationParams(req.query, {
      defaultSortBy:     AI_REQUEST_DEFAULT_SORT_BY,
      defaultSortOrder:  AI_REQUEST_DEFAULT_SORT_ORDER,
      allowedSortFields: AI_REQUEST_ALLOWED_SORT_FIELDS as unknown as string[],
    });

    const filter: Record<string, any> = { user: userId };

    if (service)  filter.service  = service;
    if (status)   filter.status   = status;
    if (priority) filter.priority = priority;

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from as string);
      if (to)   filter.createdAt.$lte = new Date(to as string);
    }

    const result = await paginate(AIRequestModel, filter, { page, limit, sort });

    console.log(`[AIRequest] getMyAIRequests — total: ${result.pagination.total}`);

    return successHandler(res, 200, true, "Your AI requests fetched successfully.", { result });
  } catch (error) {
    console.error("❌ Error in getMyAIRequests:", error);
    next(error);
  }
});

// USER — Get Single Own Request
// GET /api/v1/ai/get/:requestId

export const getAIRequestById = AsyncHandler(async (req, res, next) => {
  try {
    const userId              = req.user?.id;
    const requestId = req.params.requestId as string;

    console.log(`[AIRequest] getAIRequestById — requestId: ${requestId}`);

    const cached = await aiRequestCache.get(aiRequestCache.keys.byId(requestId));

    if (cached) {
      console.log(`[AIRequest] Cache HIT — requestId: ${requestId}`);
      return successHandler(res, 200, true, "AI request fetched successfully (cached).", {
        aiRequest: cached,
      });
    }

    const aiRequest = await AIRequestModel.findOne({
      _id:  requestId,
      user: userId,
    }).lean();

    if (!aiRequest) {
      return errorHandler(res, 404, false, "AI request not found.", {});
    }

    await aiRequestCache.set(aiRequestCache.keys.byId(requestId), aiRequest);

    console.log(`[AIRequest] getAIRequestById — found: ${aiRequest._id}`);

    return successHandler(res, 200, true, "AI request fetched successfully.", { aiRequest });
  } catch (error) {
    console.error("❌ Error in getAIRequestById:", error);
    next(error);
  }
});

// USER — Cancel a PENDING Request
// PATCH /api/v1/ai/cancel/:requestId

export const cancelAIRequest = AsyncHandler(async (req, res, next) => {
  try {
    const userId            = req.user?.id;
    const requestId: string = req.params.requestId as string;

    console.log(`[AIRequest] cancelAIRequest — requestId: ${requestId}, userId: ${userId}`);

    if (!userId) {
      return errorHandler(res, 401, false, "Unauthorized", {});
    }

    const aiRequest = await AIRequestModel.findOne({ _id: requestId, user: userId });

    if (!aiRequest) {
      return errorHandler(res, 404, false, "AI request not found.", {});
    }

    if (aiRequest.status !== AIRequestStatus.PENDING) {
      return errorHandler(
        res, 400, false,
        `Cannot cancel a request with status "${aiRequest.status}". Only PENDING requests can be cancelled.`,
        { currentStatus: aiRequest.status },
      );
    }

    aiRequest.status = AIRequestStatus.CANCELLED;
    await aiRequest.save();

    console.log(`[AIRequest] Cancelled — ${aiRequest._id}`);

    await aiRequestCache.invalidate(requestId);

    return successHandler(res, 200, true, "AI request cancelled successfully.", { aiRequest });
  } catch (error) {
    console.error("❌ Error in cancelAIRequest:", error);
    next(error);
  }
});

// ADMIN — List All Requests
// GET /api/v1/admin/ai/all

export const getAllAIRequests = AsyncHandler(async (req, res, next) => {
  try {
    const { userId, service, provider, status, priority, from, to } = req.query;

    console.log("[AIRequest] getAllAIRequests — filters:", {
      userId, service, provider, status, priority, from, to,
    });

    const { page, limit, sort } = parsePaginationParams(req.query, {
      defaultSortBy:     AI_REQUEST_DEFAULT_SORT_BY,
      defaultSortOrder:  AI_REQUEST_DEFAULT_SORT_ORDER,
      allowedSortFields: AI_REQUEST_ALLOWED_SORT_FIELDS as unknown as string[],
    });

    const filter: Record<string, any> = {};

    if (userId)   filter.user     = new mongoose.Types.ObjectId(userId as string);
    if (service)  filter.service  = service;
    if (provider) filter.provider = provider;
    if (status)   filter.status   = status;
    if (priority) filter.priority = priority;

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from as string);
      if (to)   filter.createdAt.$lte = new Date(to as string);
    }

    const result = await paginate(AIRequestModel, filter, { page, limit, sort });

    console.log(`[AIRequest] getAllAIRequests — total: ${result.pagination.total}`);

    return successHandler(res, 200, true, "All AI requests fetched successfully.", { result });
  } catch (error) {
    console.error("❌ Error in getAllAIRequests:", error);
    next(error);
  }
});

// ADMIN — Get Single Request (full detail, populated)
// GET /api/v1/admin/ai/get/:requestId

export const adminGetAIRequestById = AsyncHandler(async (req, res, next) => {
  try {
    const requestId: string = req.params.requestId as string;

    console.log(`[AIRequest] adminGetAIRequestById — requestId: ${requestId}`);

    const aiRequest = await AIRequestModel.findById(requestId)
      .populate("user",          "name email role")
      .populate("transactionId", "type amount balanceBefore balanceAfter source createdAt")
      .lean();

    if (!aiRequest) {
      return errorHandler(res, 404, false, "AI request not found.", {});
    }

    return successHandler(res, 200, true, "AI request fetched successfully.", { aiRequest });
  } catch (error) {
    console.error("❌ Error in adminGetAIRequestById:", error);
    next(error);
  }
});

// ADMIN — Update Request
// PUT /api/v1/admin/ai/update/:requestId

export const updateAIRequest = AsyncHandler(async (req, res, next) => {
  try {
    const requestId = req.params.requestId as string;
    const updates   = req.body;

    console.log(`[AIRequest] updateAIRequest — requestId: ${requestId}`);

    const aiRequest = await AIRequestModel.findByIdAndUpdate(
      requestId,
      { $set: updates },
      { new: true, runValidators: true },
    ).lean();

    if (!aiRequest) {
      return errorHandler(res, 404, false, "AI request not found.", {});
    }

    console.log(`[AIRequest] Updated — ${aiRequest._id}`);

    await aiRequestCache.update(requestId, aiRequest);

    return successHandler(res, 200, true, "AI request updated successfully.", { aiRequest });
  } catch (error) {
    console.error("❌ Error in updateAIRequest:", error);
    next(error);
  }
});

// ADMIN — Delete Request
// DELETE /api/v1/admin/ai/delete/:requestId

export const deleteAIRequest = AsyncHandler(async (req, res, next) => {
  try {
    const requestId = req.params.requestId as string; // FIX: explicit string

    console.log(`[AIRequest] deleteAIRequest — requestId: ${requestId}`);

    const aiRequest = await AIRequestModel.findByIdAndDelete(requestId).lean();

    if (!aiRequest) {
      return errorHandler(res, 404, false, "AI request not found.", {});
    }

    console.log(`[AIRequest] Deleted — ${aiRequest._id}`);

    await aiRequestCache.invalidate(requestId);

    return successHandler(res, 200, true, "AI request deleted successfully.", {});
  } catch (error) {
    console.error("❌ Error in deleteAIRequest:", error);
    next(error);
  }
});

// ADMIN — Usage Stats (aggregated)
// GET /api/v1/admin/ai/stats

export const adminGetUsageStats = AsyncHandler(async (req, res, next) => {
  try {
    const { from, to } = req.query;

    console.log(`[AIRequest] adminGetUsageStats — from: ${from}, to: ${to}`);

    const matchStage: Record<string, any> = {};

    if (from || to) {
      matchStage.createdAt = {};
      if (from) matchStage.createdAt.$gte = new Date(from as string);
      if (to)   matchStage.createdAt.$lte = new Date(to as string);
    }

    const [overview, byService, byProvider, byStatus] = await Promise.all([
      AIRequestModel.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id:                null,
            totalRequests:      { $sum: 1 },
            totalTokensCharged: { $sum: "$tokenCost" },
            avgLatencyMs:       { $avg: "$latencyMs" },
            completedCount: {
              $sum: { $cond: [{ $eq: ["$status", AIRequestStatus.COMPLETED] }, 1, 0] },
            },
            failedCount: {
              $sum: { $cond: [{ $eq: ["$status", AIRequestStatus.FAILED] }, 1, 0] },
            },
            cancelledCount: {
              $sum: { $cond: [{ $eq: ["$status", AIRequestStatus.CANCELLED] }, 1, 0] },
            },
          },
        },
      ]),

      AIRequestModel.aggregate([
        { $match: { ...matchStage, status: AIRequestStatus.COMPLETED } },
        {
          $group: {
            _id:         "$service",
            count:       { $sum: 1 },
            totalTokens: { $sum: "$tokenCost" },
            avgLatency:  { $avg: "$latencyMs" },
          },
        },
        { $sort: { count: -1 } },
      ]),

      AIRequestModel.aggregate([
        { $match: { ...matchStage, status: AIRequestStatus.COMPLETED } },
        {
          $group: {
            _id:          "$provider",
            count:        { $sum: 1 },
            avgLatencyMs: { $avg: "$latencyMs" },
            totalTokens:  { $sum: "$tokenCost" },
          },
        },
        { $sort: { count: -1 } },
      ]),

      AIRequestModel.aggregate([
        { $match: matchStage },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    return successHandler(res, 200, true, "Usage stats retrieved successfully.", {
      overview: overview[0] ?? {
        totalRequests:      0,
        totalTokensCharged: 0,
        avgLatencyMs:       0,
        completedCount:     0,
        failedCount:        0,
        cancelledCount:     0,
      },
      byService,
      byProvider,
      byStatus,
    });
  } catch (error) {
    console.error("❌ Error in adminGetUsageStats:", error);
    next(error);
  }
});
// USER — Generate Image (with upload)
// POST /api/v1/ai-request/generate-image

import { uploadFile } from "@/utils/cloudinary.util.js";
import { AIAssetModel } from "../admin/asset.model.js";

export const generateImageHandler = AsyncHandler(async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { prompt, aspectRatio, modelType } = req.body;

    console.log(`[AIRequest] generateImageHandler — userId: ${userId}`);

    if (!userId) {
      return errorHandler(res, 401, false, "Unauthorized", {});
    }

    let uploadedImageUrl = "";
    if (req.file) {
      const uploadRes = await uploadFile(req.file.path, "assets", "image");
      uploadedImageUrl = uploadRes.secure_url;
    }

    const finalPrompt = uploadedImageUrl 
      ? `[Reference Image: ${uploadedImageUrl}] ${prompt}`
      : prompt;

    // ── Check Subscription & Tokens (Simplified) ──
    const subscription = await UserSubscriptionModel.findOne({ user: userId, status: "active" }).lean();
    if (!subscription || (subscription.endDate && new Date(subscription.endDate) < new Date())) {
      return errorHandler(res, 403, false, "Active subscription required.", {});
    }

    const wallet = await TokenWalletModel.findOne({ userId });
    if (!wallet) return errorHandler(res, 404, false, "Wallet not found.", {});

    const estimatedCost = 5; // Image generation fixed cost for now
    if (wallet.balance < estimatedCost) {
      return errorHandler(res, 402, false, "Insufficient tokens for image generation.", {});
    }

    // ── Execute Provider Call ──
    let providerName = "huggingface";
    let modelToUse = modelType || "stabilityai/stable-diffusion-xl-base-1.0";

    const systemModel = await SystemModelModel.findOne({
      $or: [
        { version: modelType },
        { name: modelType },
        { _id: mongoose.Types.ObjectId.isValid(modelType) ? modelType : null }
      ],
      type: "image",
      status: "active"
    }).lean();

    if (systemModel) {
      providerName = (systemModel.provider || "huggingface").toLowerCase();
      modelToUse = systemModel.version;
    } else {
      const serviceConfig = await ServiceConfigModel.findOne({ service: "image_gen", enabled: true }).lean();
      const providers = serviceConfig?.providers?.filter((p: any) => p.enabled).sort((a: any, b: any) => a.priority - b.priority) || [];
      if (providers[0]) {
        providerName = providers[0].provider;
        modelToUse = modelType || providers[0].model;
      }
    }

    // Reserve Tokens
    wallet.balance -= estimatedCost;
    await wallet.save();
    
    await TokenTransaction.create([{
      userId,
      type: TransactionType.CONSUMPTION,
      source: TransactionSource.AI_REQUEST,
      status: TransactionStatus.COMPLETED,
      amount: estimatedCost,
      balanceBefore: wallet.balance + estimatedCost,
      balanceAfter: wallet.balance,
      metadata: { service: "image_gen" },
    }]);

    const result = await executeProviderRequest(
      providerName,
      "",
      { model: modelToUse, prompt: finalPrompt },
      "image_gen"
    );

    if (!result.success || !result.imageUrls?.length) {
      // Refund
      wallet.balance += estimatedCost;
      await wallet.save();
      return errorHandler(res, 500, false, result.error?.message || "Failed to generate image", {});
    }

    // ── Save Asset ──
    const newAsset = await AIAssetModel.create({
      user: userId,
      type: "image",
      title: prompt.substring(0, 40) + "...",
      prompt: finalPrompt,
      content: result.imageUrls[0],
      model: modelToUse
    });

    return successHandler(res, 201, true, "Image generated successfully.", { asset: newAsset });
  } catch (error) {
    console.error("❌ Error in generateImageHandler:", error);
    next(error);
  }
});
