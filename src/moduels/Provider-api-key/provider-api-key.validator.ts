import z from "zod";
import { ProviderName } from "../Provider/provider-config.types.js";
import { AdapterType } from "./provider-api-key.types.js";

export const createProviderApiKeySchema = z.object({
  body: z.object({
    provider: z.nativeEnum(ProviderName, {
      error: () => ({
        message: `provider must be one of: ${Object.values(ProviderName).join(", ")}`,
      }),
    }),

    apiKey: z
      .string()
      .min(8, "apiKey must be at least 8 characters")
      .nullable()
      .optional()
      .default(null),

    baseUrl: z
      .string()
      .url("baseUrl must be a valid URL")
      .nullable()
      .optional()
      .default(null),

    adapterType: z.nativeEnum(AdapterType, {
      error: () => ({
        message: `adapterType must be one of: ${Object.values(AdapterType).join(", ")}`,
      }),
    }),

    label: z
      .string()
      .min(1, "label is required")
      .max(100, "label must not exceed 100 characters")
      .trim(),

    active: z.boolean().optional().default(true),

    note: z
      .string()
      .max(500, "note must not exceed 500 characters")
      .nullable()
      .optional()
      .default(null),
  }),
});

export const updateProviderApiKeySchema = z.object({
  params: z.object({
    provider: z.nativeEnum(ProviderName, {
      error: () => ({
        message: `provider must be one of: ${Object.values(ProviderName).join(", ")}`,
      }),
    }),
  }),

  body: z
    .object({
      apiKey: z
        .string()
        .min(8, "apiKey must be at least 8 characters")
        .nullable()
        .optional(),

      baseUrl: z
        .string()
        .url("baseUrl must be a valid URL")
        .nullable()
        .optional(),

      adapterType: z
        .nativeEnum(AdapterType, {
          error: () => ({
            message: `adapterType must be one of: ${Object.values(AdapterType).join(", ")}`,
          }),
        })
        .optional(),

      label: z
        .string()
        .min(1, "label is required")
        .max(100, "label must not exceed 100 characters")
        .trim()
        .optional(),

      active: z.boolean().optional(),

      note: z
        .string()
        .max(500, "note must not exceed 500 characters")
        .nullable()
        .optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided for update",
    }),
});

/**
 * toggleProviderApiKeySchema
 *
 * Used by: PATCH /admin/provider-api-keys/:provider/toggle
 */
export const toggleProviderApiKeySchema = z.object({
  params: z.object({
    provider: z.nativeEnum(ProviderName, {
      error: () => ({
        message: `provider must be one of: ${Object.values(ProviderName).join(", ")}`,
      }),
    }),
  }),

  body: z.object({
    active: z.boolean({
      error: (issue) => {
        if (issue.input === undefined) {
          return "active is required";
        }

        return "active must be a boolean";
      },
    }),
  }),
});

export const providerParamSchema = z.object({
  params: z.object({
    provider: z.nativeEnum(ProviderName, {
      error: () => ({
        message: `provider must be one of: ${Object.values(ProviderName).join(", ")}`,
      }),
    }),
  }),
});

export type CreateProviderApiKeyInput = z.infer<
  typeof createProviderApiKeySchema
>["body"];

export type UpdateProviderApiKeyInput = z.infer<
  typeof updateProviderApiKeySchema
>["body"];
