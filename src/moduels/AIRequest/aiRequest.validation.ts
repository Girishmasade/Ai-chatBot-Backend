import { z } from "zod";
import { AIService } from "../service-config/service-config.types.js";
import { ProviderName } from "../Provider/provider-config.types.js";
import { AIRequestStatus, AIRequestPriority } from "./aiRequest.type.js";

// ─── Shared helpers ───────────────────────────────────────────────────────────

const objectIdParam = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId format");

const conversationMessageSchema = z.object({
  role:    z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(32_000),
});

const paginationQuery = z.object({
  page:      z.string().optional(),
  limit:     z.string().optional(),
  sortBy:    z.enum(["createdAt", "tokenCost", "latencyMs"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

// ─── Execute AI Request ───────────────────────────────────────────────────────
// NOTE: `provider` is intentionally absent from the body.
// Provider selection is resolved server-side from ServiceConfig + ProviderModel.
// Clients must never be allowed to pick or override the provider.

export const executeAIRequestSchema = z.object({
  body: z.object({
    service: z.nativeEnum(AIService, {
      error: "A valid service type is required",
    }),

    prompt: z
      .string()
      .trim()
      .min(1, "Prompt is required")
      .max(10_000, "Prompt must be under 10,000 characters"),

    systemPrompt: z
      .string()
      .trim()
      .max(8_000, "System prompt must be under 8,000 characters")
      .optional(),

    conversationHistory: z
      .array(conversationMessageSchema)
      .max(50, "Conversation history cannot exceed 50 messages")
      .optional(),

    // Model override: allowed only if the user explicitly provides one.
    // The controller validates it against the provider's available models.
    model: z.string().trim().max(100).optional(),

    priority: z.nativeEnum(AIRequestPriority).optional(),

    parameters: z
      .object({
        temperature:      z.number().min(0).max(2).optional(),
        maxTokens:        z.number().int().min(1).max(16_384).optional(),
        topP:             z.number().min(0).max(1).optional(),
        frequencyPenalty: z.number().min(-2).max(2).optional(),
        presencePenalty:  z.number().min(-2).max(2).optional(),
        // Image-specific
        size:    z.enum(["256x256", "512x512", "1024x1024", "1792x1024", "1024x1792"]).optional(),
        quality: z.enum(["standard", "hd"]).optional(),
        style:   z.enum(["vivid", "natural"]).optional(),
        n:       z.number().int().min(1).max(4).optional(),
        // Vision-specific
        imageUrl: z.string().url("imageUrl must be a valid URL").max(2_048).optional(),
      })
      .optional(),

    metadata: z.record(z.string(), z.any()).optional(),
  }),
});

// ─── Estimate Token Cost ──────────────────────────────────────────────────────

export const estimateCostSchema = z.object({
  body: z.object({
    service: z.nativeEnum(AIService),
    prompt:  z.string().trim().min(1).max(10_000),
    systemPrompt:        z.string().trim().max(8_000).optional(),
    conversationHistory: z.array(conversationMessageSchema).max(50).optional(),
  }),
});

// ─── Get single request by ID ─────────────────────────────────────────────────

export const getAIRequestByIdSchema = z.object({
  params: z.object({
    requestId: objectIdParam,
  }),
});

// ─── Cancel request (user) ────────────────────────────────────────────────────

export const cancelAIRequestSchema = z.object({
  params: z.object({
    requestId: objectIdParam,
  }),
});

// ─── List my requests (authenticated user) ────────────────────────────────────

export const listMyRequestsSchema = z.object({
  query: paginationQuery.extend({
    service:  z.nativeEnum(AIService).optional(),
    status:   z.nativeEnum(AIRequestStatus).optional(),
    priority: z.nativeEnum(AIRequestPriority).optional(),
    from:     z.string().optional(),
    to:       z.string().optional(),
  }),
});

// ─── List all requests (admin) ────────────────────────────────────────────────

export const adminListRequestsSchema = z.object({
  query: paginationQuery.extend({
    userId:   objectIdParam.optional(),
    service:  z.nativeEnum(AIService).optional(),
    provider: z.nativeEnum(ProviderName).optional(),
    status:   z.nativeEnum(AIRequestStatus).optional(),
    priority: z.nativeEnum(AIRequestPriority).optional(),
    from:     z.string().optional(),
    to:       z.string().optional(),
  }),
});

// ─── Update request (admin) ───────────────────────────────────────────────────

export const updateAIRequestSchema = z.object({
  params: z.object({
    requestId: objectIdParam,
  }),
  body: z.object({
    status:        z.nativeEnum(AIRequestStatus).optional(),
    response:      z.string().trim().optional(),
    tokenCost:     z.number().nonnegative().optional(),
    transactionId: objectIdParam.optional(),
    latencyMs:     z.number().nonnegative().optional(),
    errorMessage:  z.string().trim().optional(),
    metadata:      z.record(z.string(), z.any()).optional(),
  }),
});