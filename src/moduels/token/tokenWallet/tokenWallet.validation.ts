import z from "zod";
import mongoose from "mongoose";
import { WalletStatus } from "./tokenWallet.types.js";

const objectIdParam = z
  .string({ error: "userId param is required" })
  .refine(mongoose.isValidObjectId, { message: "Invalid userId format" });

export const getWalletByUserIdSchema = z.object({
  params: z.object({ userId: objectIdParam }),
});

export const freezeWalletSchema = z.object({
  body: z.object({
    reason: z
      .string({ error: "Freeze reason is required" })
      .trim()
      .min(10, "Reason must be at least 10 characters")
      .max(300, "Reason cannot exceed 300 characters"),
  }),
  params: z.object({ userId: objectIdParam }),
});

export const unfreezeWalletSchema = z.object({
  params: z.object({ userId: objectIdParam }),
});

export const recalculateBalanceSchema = z.object({
  params: z.object({ userId: objectIdParam }),
});

export const listWalletsSchema = z.object({
  query: z.object({
    status: z.nativeEnum(WalletStatus).optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
  }),
});

export type GetWalletByUserIdInput  = z.infer<typeof getWalletByUserIdSchema>;
export type FreezeWalletInput       = z.infer<typeof freezeWalletSchema>;
export type UnfreezeWalletInput     = z.infer<typeof unfreezeWalletSchema>;
export type RecalculateBalanceInput = z.infer<typeof recalculateBalanceSchema>;
export type ListWalletsInput        = z.infer<typeof listWalletsSchema>;