import mongoose from "mongoose";
import { Worker, type Job } from "bullmq";
import { BullMQQueue, JobName } from "@/shared/shared.types.enum.js";
import { bullmqConnection } from "@/redis/bullmq.connection.js";
import { AIRequestModel } from "@/moduels/AIRequest/aiRequest.model.js";
import { AIRequestStatus } from "@/moduels/AIRequest/aiRequest.type.js";
import { executeProviderRequest } from "@/moduels/AIRequest/aiRequest.gateway.js";
import {
  buildAntiHallucinationPrompt,
  mapAIServiceToCategory,
} from "@/moduels/prompt/promptAntiHallucination.js";
import TokenWalletModel from "@/moduels/token/tokenWallet/tokenWallet.model.js";
import { TokenTransaction } from "@/moduels/token/tokenTransaction/tokenTransaction.model.js";
import {
  TransactionType,
  TransactionSource,
  TransactionStatus,
} from "@/moduels/token/tokenTransaction/tokenTransaction.types.js";
import { uploadMediaToCloudinary } from "@/utils/cloudinary.util.js";
import { AIAssetModel } from "@/moduels/admin/asset.model.js";
import { AuditLogModel } from "@/moduels/admin/auditLog.model.js";
import {
  emitAIJobProgress,
  emitAIJobCompleted,
  emitWalletUpdate,
  emitAdminEntityUpdate,
} from "@/socket/socket.emitter.js";
import { createCacheHelper } from "@/utils/redis.util.js";
import {
  AI_REQUEST_CACHE_NAMESPACE,
  AI_REQUEST_CACHE_TTL,
} from "@/moduels/AIRequest/aiRequest.constant.js";

const aiRequestCache = createCacheHelper({
  namespace: AI_REQUEST_CACHE_NAMESPACE,
  ttl: AI_REQUEST_CACHE_TTL,
});

export interface AIGenerationJobData {
  requestId: string;
  userId: string;
  userRole?: string;
  userEmail?: string;
  userUsername?: string;
  service: string;
  prompt: string;
  systemPrompt?: string;
  conversationHistory?: any[];
  model?: string;
  resolvedModel: string;
  priority?: string;
  parameters?: any;
  metadata?: any;
  enabledProviders: any[];
  tokensPerUnit: number;
  estimatedTokens: number;
  estimatedCost: number;
  ipAddress?: string;
}

export interface AIGenerationJobResult {
  requestId: string;
  service: string;
  response: string;
  imageUrls: string[];
  provider: string;
  model: string;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    tokensCharged: number;
  };
  latencyMs: number;
}

/**
 * BullMQ Worker for AI Generation.
 *
 * Designed to handle 1,000+ concurrent user requests gracefully:
 * - Concurrency capped at 20 parallel provider calls to avoid exhausting connection pools.
 * - Rate limited to max 30 jobs/sec to strictly prevent upstream AI provider 429 rate limit errors.
 * - Real-time Socket.IO events keep user interfaces continuously responsive.
 * - Automatic token reconciliation, failover recovery, and Cloudinary media persistence.
 */
export const aiGenerationWorker = new Worker<AIGenerationJobData, AIGenerationJobResult>(
  BullMQQueue.AI_GENERATION,
  async (job: Job<AIGenerationJobData>) => {
    if (job.name !== JobName.GENERATE_AI_RESPONSE) {
      throw new Error(`[aiGeneration.worker] Unknown job name: ${job.name}`);
    }

    const {
      requestId,
      userId,
      userEmail,
      userUsername,
      service,
      prompt,
      systemPrompt,
      conversationHistory,
      model,
      resolvedModel,
      parameters,
      metadata,
      enabledProviders,
      tokensPerUnit,
      estimatedTokens,
      estimatedCost,
    } = job.data;

    console.log(
      `[aiGeneration.worker] Processing job ${job.id} for request ${requestId} (service: ${service}, user: ${userId})`,
    );

    // ── 1. Mark PROCESSING in DB & emit Socket progress ─────────────────────────
    await AIRequestModel.findByIdAndUpdate(requestId, {
      status: AIRequestStatus.PROCESSING,
    });

    emitAIJobProgress(userId, {
      jobId: job.id!,
      requestId,
      service,
      status: "processing",
      progress: 20,
      message: "Queued request accepted, preparing prompt...",
    });

    // ── 2. Apply Anti-Hallucination Prompt Enhancement ──────────────────────────
    const category = mapAIServiceToCategory(service);
    const antiHallucinationResult = buildAntiHallucinationPrompt({
      prompt,
      options: {
        category,
        aspectRatio: parameters?.aspectRatio,
        style: parameters?.style,
        quality: parameters?.quality,
        outputFormat: parameters?.outputFormat,
        strictMode: parameters?.strictMode ?? true,
      },
      systemPromptOverride: systemPrompt,
    });

    const activePrompt = parameters?.disableAntiHallucination
      ? prompt
      : antiHallucinationResult.enhancedPrompt;
    const activeSystemPrompt = parameters?.disableAntiHallucination
      ? systemPrompt
      : antiHallucinationResult.systemPrompt;

    emitAIJobProgress(userId, {
      jobId: job.id!,
      requestId,
      service,
      status: "calling_provider",
      progress: 45,
      message: "Generating response via AI provider...",
    });

    // ── 3. Execute Provider Call with Automatic Failover ────────────────────────
    let providerResponse: any = null;
    let usedProvider: any = null;
    let usedModel = resolvedModel;
    let attemptNumber = 0;

    for (const providerConfig of enabledProviders) {
      attemptNumber++;

      const currentModel =
        attemptNumber === 1
          ? (model ?? providerConfig.model)
          : providerConfig.model;

      console.log(
        `[aiGeneration.worker] Job ${job.id} Attempt ${attemptNumber} — provider: ${providerConfig.provider}, model: ${currentModel}`,
      );

      const result = await executeProviderRequest(
        providerConfig.provider,
        "",
        {
          model: currentModel,
          prompt: activePrompt,
          systemPrompt: activeSystemPrompt,
          conversationHistory,
          parameters: {
            ...parameters,
            imageUrl: parameters?.imageUrl,
            negativePrompt: antiHallucinationResult.negativePrompt,
          },
          maxTokens: providerConfig.maxTokens ?? parameters?.maxTokens,
          temperature: providerConfig.temperature ?? parameters?.temperature,
        },
        service,
      );

      if (result.success) {
        providerResponse = result;
        usedProvider = providerConfig;
        usedModel = currentModel;
        break;
      }

      console.warn(
        `[aiGeneration.worker] Provider ${providerConfig.provider} failed on attempt ${attemptNumber}: ${result.error?.message}`,
      );
    }

    // ── 4. All Providers Failed → Refund Reserved Tokens & Mark FAILED ──────────
    if (!providerResponse?.success) {
      console.error(
        `[aiGeneration.worker] All providers failed for job ${job.id} (request: ${requestId})`,
      );

      const dbSession = await mongoose.startSession().catch(() => null);
      let releasedSuccess = false;

      if (dbSession) {
        try {
          await dbSession.withTransaction(async () => {
            const walletRestore = await TokenWalletModel.findOne({ userId }).session(dbSession);
            if (!walletRestore) return;

            const balanceBefore = walletRestore.balance;
            walletRestore.balance += estimatedCost;
            await walletRestore.save({ session: dbSession });

            await TokenTransaction.create(
              [
                {
                  userId,
                  type: TransactionType.REVERSAL,
                  source: TransactionSource.SYSTEM,
                  status: TransactionStatus.COMPLETED,
                  amount: estimatedCost,
                  balanceBefore,
                  balanceAfter: walletRestore.balance,
                  aiRequestId: requestId,
                  metadata: {
                    service,
                    reason: "ALL_PROVIDERS_FAILED",
                  },
                },
              ],
              { session: dbSession },
            );
          });
          releasedSuccess = true;
        } catch (releaseErr) {
          console.warn("[aiGeneration.worker] Transaction release fallback:", releaseErr);
        }
      }

      if (!releasedSuccess) {
        const walletRestore = await TokenWalletModel.findOne({ userId });
        if (walletRestore) {
          const balanceBefore = walletRestore.balance;
          walletRestore.balance += estimatedCost;
          await walletRestore.save();
          await TokenTransaction.create({
            userId,
            type: TransactionType.REVERSAL,
            source: TransactionSource.SYSTEM,
            status: TransactionStatus.COMPLETED,
            amount: estimatedCost,
            balanceBefore,
            balanceAfter: walletRestore.balance,
            aiRequestId: requestId,
            metadata: { service, reason: "ALL_PROVIDERS_FAILED" },
          });
        }
      }

      if (dbSession) await dbSession.endSession().catch(() => {});

      const errorMessage =
        providerResponse?.error?.message ?? "All AI providers failed to respond.";

      await AIRequestModel.findByIdAndUpdate(requestId, {
        status: AIRequestStatus.FAILED,
        provider: usedProvider?.provider ?? enabledProviders[0]?.provider,
        errorMessage,
      });

      await aiRequestCache.invalidate(String(requestId));

      emitAIJobCompleted(userId, {
        jobId: job.id!,
        requestId,
        service,
        success: false,
        error: "AI service is temporarily unavailable. Your tokens have been refunded.",
      });

      throw new Error(
        "AI service is temporarily unavailable. Your tokens have been refunded. Please try again.",
      );
    }

    // ── 5. Reconcile Actual Token Cost ──────────────────────────────────────────
    const actualTokens = providerResponse.usage?.totalTokens || estimatedTokens;
    const actualCost = Math.ceil(actualTokens * tokensPerUnit);
    const delta = estimatedCost - actualCost; // positive = overpaid

    const dbSession = await mongoose.startSession().catch(() => null);
    let reconciledSuccess = false;

    if (dbSession) {
      try {
        await dbSession.withTransaction(async () => {
          const walletFinal = await TokenWalletModel.findOne({ userId }).session(dbSession);
          if (!walletFinal) throw new Error("Wallet missing during reconciliation");

          const balanceBefore = walletFinal.balance;

          if (delta > 0) {
            walletFinal.balance += delta;
            walletFinal.totalConsumed = (walletFinal.totalConsumed ?? 0) + actualCost;
            await walletFinal.save({ session: dbSession });

            await TokenTransaction.create(
              [
                {
                  userId,
                  type: TransactionType.REVERSAL,
                  source: TransactionSource.SYSTEM,
                  status: TransactionStatus.COMPLETED,
                  amount: delta,
                  balanceBefore,
                  balanceAfter: walletFinal.balance,
                  aiRequestId: requestId,
                  metadata: { estimatedCost, actualCost, delta, reconcileReason: "OVERPAID" },
                },
              ],
              { session: dbSession },
            );
          } else if (delta < 0) {
            const shortfall = Math.abs(delta);
            if (walletFinal.balance >= shortfall) {
              walletFinal.balance -= shortfall;
              walletFinal.totalConsumed = (walletFinal.totalConsumed ?? 0) + actualCost;
              await walletFinal.save({ session: dbSession });

              await TokenTransaction.create(
                [
                  {
                    userId,
                    type: TransactionType.CONSUMPTION,
                    source: TransactionSource.AI_REQUEST,
                    status: TransactionStatus.COMPLETED,
                    amount: shortfall,
                    balanceBefore,
                    balanceAfter: walletFinal.balance,
                    aiRequestId: requestId,
                    metadata: { estimatedCost, actualCost, shortfall, reconcileReason: "UNDERPAID" },
                  },
                ],
                { session: dbSession },
              );
            } else {
              walletFinal.totalConsumed = (walletFinal.totalConsumed ?? 0) + actualCost;
              await walletFinal.save({ session: dbSession });
            }
          } else {
            walletFinal.totalConsumed = (walletFinal.totalConsumed ?? 0) + actualCost;
            await walletFinal.save({ session: dbSession });
          }
        });
        reconciledSuccess = true;
      } catch (recErr) {
        console.warn("[aiGeneration.worker] Transaction reconciliation fallback:", recErr);
      }
    }

    if (!reconciledSuccess) {
      const walletFinal = await TokenWalletModel.findOne({ userId });
      if (walletFinal) {
        if (delta > 0) {
          walletFinal.balance += delta;
        } else if (delta < 0) {
          const shortfall = Math.abs(delta);
          if (walletFinal.balance >= shortfall) walletFinal.balance -= shortfall;
        }
        walletFinal.totalConsumed = (walletFinal.totalConsumed ?? 0) + actualCost;
        await walletFinal.save();
      }
    }

    if (dbSession) await dbSession.endSession().catch(() => {});

    // ── 6. Save Media to Cloudinary if image or video output ────────────────────
    if (providerResponse.imageUrls && providerResponse.imageUrls.length > 0) {
      emitAIJobProgress(userId, {
        jobId: job.id!,
        requestId,
        service,
        status: "uploading_media",
        progress: 85,
        message: "Saving generated media to vault...",
      });

      const isVideo = service === "video_gen";
      const uploadedCloudinaryUrl = await uploadMediaToCloudinary(
        providerResponse.imageUrls[0],
        "ai_assets",
        isVideo ? "video" : "auto",
      );
      providerResponse.imageUrls[0] = uploadedCloudinaryUrl;

      await AIAssetModel.create({
        user: userId,
        type: isVideo ? "video" : "image",
        title: prompt.substring(0, 40) + "...",
        prompt,
        content: uploadedCloudinaryUrl,
        model: usedModel,
      }).catch((assetErr) =>
        console.warn("[aiGeneration.worker] Failed to create AIAsset record:", assetErr),
      );
    }

    // ── 7. Mark COMPLETED in DB ─────────────────────────────────────────────────
    await AIRequestModel.findByIdAndUpdate(
      requestId,
      {
        status: AIRequestStatus.COMPLETED,
        provider: usedProvider!.provider,
        model: usedModel,
        response: providerResponse.content,
        tokenCost: actualCost,
        latencyMs: providerResponse.latencyMs,
        metadata: {
          ...metadata,
          providerRequestId: providerResponse.providerRequestId,
          attemptNumber,
          promptTokens: providerResponse.usage?.promptTokens || 0,
          completionTokens: providerResponse.usage?.completionTokens || 0,
          totalTokens: providerResponse.usage?.totalTokens || actualTokens,
          tokensCharged: actualCost,
          imageUrls: providerResponse.imageUrls ?? [],
        },
      },
      { returnDocument: "after" },
    );

    // ── 8. Real-Time Socket Notifications & Audit Logs ──────────────────────────
    try {
      const walletUpdated = await TokenWalletModel.findOne({ userId });
      if (walletUpdated) {
        emitWalletUpdate(userId, {
          balance: walletUpdated.balance,
          totalConsumed: walletUpdated.totalConsumed,
          reason: "DEDUCTION",
        });
      }

      await AuditLogModel.create({
        action: "AI Model Utilized",
        operator: userUsername || "User",
        details: `User ${userEmail || "User"} used service '${service}' with model '${usedModel}' (${actualCost} cr)`,
        level: "info",
      }).catch(() => {});

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
      console.error("[aiGeneration.worker] Real-time notification error:", notifyErr);
    }

    await aiRequestCache.invalidate(String(requestId));

    const finalResult: AIGenerationJobResult = {
      requestId,
      service,
      response: providerResponse.content,
      imageUrls: providerResponse.imageUrls ?? [],
      provider: usedProvider!.provider,
      model: usedModel,
      tokenUsage: {
        promptTokens: providerResponse.usage?.promptTokens || 0,
        completionTokens: providerResponse.usage?.completionTokens || 0,
        totalTokens: providerResponse.usage?.totalTokens || actualTokens,
        tokensCharged: actualCost,
      },
      latencyMs: providerResponse.latencyMs,
    };

    emitAIJobCompleted(userId, {
      jobId: job.id!,
      requestId,
      service,
      success: true,
      result: finalResult,
    });

    console.log(
      `[aiGeneration.worker] Finished job ${job.id} for request ${requestId} (cost: ${actualCost} tokens, latency: ${providerResponse.latencyMs}ms)`,
    );

    return finalResult;
  },
  {
    connection: bullmqConnection,
    // Concurrency: 20 simultaneous workers prevent DB connection starvation and provider timeouts
    concurrency: 20,
    // Limiter: Maximum 30 requests started per 1 second window to prevent upstream provider 429 errors
    limiter: {
      max: 30,
      duration: 1000,
    },
  },
);

aiGenerationWorker.on("completed", (job) => {
  console.log(`[aiGeneration.worker] Job ${job.id} (${job.name}) completed successfully`);
});

aiGenerationWorker.on("failed", (job, err) => {
  console.error(`[aiGeneration.worker] Job ${job?.id} (${job?.name}) failed:`, err.message);
});
