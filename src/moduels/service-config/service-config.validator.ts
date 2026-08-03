import { z } from "zod";
import { AIService } from "./service-config.types.js";
import { providerSchema } from "../Provider/provider-config.validator.js";

export const createServiceSchema = z
  .object({
    service: z.nativeEnum(AIService, {
      error: "Invalid AI service",
    }),

    enabled: z.boolean().default(true),

    fallbackEnabled: z.boolean().default(true),

    cacheEnabled: z.boolean().default(true),

    rateLimitPerMinute: z
      .number({ error: "Rate limit must be a number" })
      .int("Rate limit must be an integer")
      .min(1, "Rate limit must be at least 1")
      .max(10000, "Rate limit is too high")
      .default(60),

    providers: z
      .array(providerSchema)
      .min(1, "At least one provider is required"),
  })
  .superRefine((data, ctx) => {
    const providerNames = new Set<string>();
    const priorities = new Set<number>();

    for (const p of data.providers) {
      if (providerNames.has(p.provider)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate provider '${p.provider}' is not allowed`,
          path: ["providers"],
        });
      }
      providerNames.add(p.provider);

      if (priorities.has(p.priority)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate priority '${p.priority}' is not allowed`,
          path: ["providers"],
        });
      }
      priorities.add(p.priority);
    }

    if (data.enabled) {
      const hasActiveProvider = data.providers.some((p) => p.enabled);

      if (!hasActiveProvider) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "At least one enabled provider is required when service is enabled",
          path: ["providers"],
        });
      }
    }
  });

  // update service schema

  export const updateServiceSchema = z.object({
      fallbackEnabled: z.boolean().optional(),
    cacheEnabled: z.boolean().optional(),
    rateLimitPerMinute: z
      .number({ error: "Rate limit must be a number" })
      .int("Rate limit must be an integer")
      .min(1, "Rate limit must be at least 1")
      .max(10000, "Rate limit is too high")
      .optional(),
  })
    .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: "At least one field must be provided" },
  );

  // toggle service schema

  export const toggleServiceSchema = z.object({
  enabled: z.boolean({ error: "enabled must be a boolean" }),
});

// toggle fallback schema

export const toggleFallbackSchema = z.object({
  fallbackEnabled: z.boolean({ error: "fallbackEnabled must be a boolean" }),
});

// update rate limit session

export const updateRateLimitSchema = z.object({
  rateLimitPerMinute: z
    .number({ error: "Rate limit must be a number" })
    .int("Rate limit must be an integer")
    .min(1, "Rate limit must be at least 1")
    .max(10000, "Rate limit is too high"),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type ToggleServiceInput = z.infer<typeof toggleServiceSchema>;
export type ToggleFallbackInput = z.infer<typeof toggleFallbackSchema>;
export type UpdateRateLimitInput = z.infer<typeof updateRateLimitSchema>;