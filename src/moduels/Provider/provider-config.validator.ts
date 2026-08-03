import { z } from "zod";
import { ProviderName, ProviderHealthStatus } from "./provider-config.types.js";

//  Provider Schema

export const providerSchema = z.object({
  provider: z.nativeEnum(ProviderName, {
    error: "Invalid provider name",
  }),

  model: z
    .string()
    .trim()
    .min(1, "model is required")
    .max(200, "Model name is too long 200 chars"),

  priority: z
    .number({error: "Priority must be a number"})
    .int("Priority must be an integer")
    .min(1, "Priority must be at least 1")
    .max(100, "Priority must be at most 100"),

  enabled: z.boolean().default(true),

  timeout: z
    .number({error: "Timeout must be a number"})
    .int("Timeout must be an integer")
    .min(1000, "Timeout must be at least 1000ms")
    .max(60000, "Timeout cannot exceed 60000ms")
    .default(10000),

  maxRetries: z
       .number({ error: "Max retries must be a number" })
    .int("Max retries must be an integer")
    .min(0, "Max retries cannot be negative")
    .max(5, "Max retries cannot exceed 5")
    .default(1)
    .optional(),

    temperature: z
    .number({ error: "Temperature must be a number" })
    .min(0, "Temperature cannot be less than 0")
    .max(2, "Temperature cannot exceed 2")
    .optional(),

  maxTokens: z
    .number({ error: "Max tokens must be a number" })
    .int("Max tokens must be an integer")
    .min(1, "Max tokens must be at least 1")
    .optional(),
});

// validation for toggle provider schema

export const toggleProviderSchema = z.object({
    enabled: z.boolean({
        error: "enabled must be a boolean"
    })
})

// validation for update provider priority schema

export const updateProviderPrioritySchema = z.object({
  priority: z
    .number({ error: "Priority must be a number" })
    .int("Priority must be an integer")
    .min(1, "Priority must be at least 1"),
});

// validation for update provider model schema

export const updateProviderModelSchema = z.object({
  model: z
    .string({ error: "Model must be a string" })
    .trim()
    .min(1, "Model is required")
    .max(200, "Model name is too long"),
})

// validation for update provider timeout schema

export const updateProviderTimeoutSchema = z.object({
  timeout: z
    .number({ error: "Timeout must be a number" })
    .int("Timeout must be an integer")
    .min(1000, "Timeout must be at least 1000ms")
    .max(60000, "Timeout cannot exceed 60000ms"),
});

// validation for update provider retries schema

export const updateProviderRetriesSchema = z.object({
  maxRetries: z
    .number({ error: "Max retries must be a number" })
    .int("Max retries must be an integer")
    .min(0, "Max retries cannot be negative")
    .max(5, "Max retries cannot exceed 5"),
});

// validation for update provider Health schema

export const updateProviderHealthSchema = z.object({
  healthStatus: z.nativeEnum(ProviderHealthStatus, {
    error: "Invalid health status",
  }),

  averageResponseTime: z
    .number({ error: "Average response time must be a number" })
    .min(0, "Average response time cannot be negative")
    .optional(),
});

export type ProviderInput = z.infer<typeof providerSchema>;
export type ToggleProviderInput = z.infer<typeof toggleProviderSchema>;
export type UpdateProviderPriorityInput = z.infer<typeof updateProviderPrioritySchema>;
export type UpdateProviderModelInput = z.infer<typeof updateProviderModelSchema>;
export type UpdateProviderTimeoutInput = z.infer<typeof updateProviderTimeoutSchema>;
export type UpdateProviderRetriesInput = z.infer<typeof updateProviderRetriesSchema>;
export type UpdateProviderHealthInput = z.infer<typeof updateProviderHealthSchema>;