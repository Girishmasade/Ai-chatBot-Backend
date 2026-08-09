import z from "zod";
import { TransactionSource, TransactionStatus, TransactionType } from "./tokenTransaction.types.js";

const mongoIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid MongoDB ObjectId');

export const adjustBalanceSchema = z.object({
  params: z.object({
    userId: mongoIdSchema,
  }),
  body: z.object({
    amount: z
      .number({ error: 'amount is required' })
      .int('Amount must be an integer')
      .refine((v) => v !== 0, 'Amount cannot be zero'),
    reason: z
      .string({ error: 'reason is required' })
      .trim()
      .min(10, 'Reason must be at least 10 characters — be specific for audit purposes')
      .max(500, 'Reason cannot exceed 500 characters'),
  }),
});

export const grantBonusSchema = z.object({
  params: z.object({
    userId: mongoIdSchema,
  }),
  body: z.object({
    amount: z
      .number({ error: 'amount is required' })
      .int('Amount must be an integer')
      .positive('Bonus amount must be positive'),
    description: z.string().trim().max(300).optional(),
  }),
});

export const reverseTransactionSchema = z.object({
  params: z.object({
    transactionId: mongoIdSchema,
  }),
  body: z.object({
    reason: z
      .string({ error: 'reason is required' })
      .trim()
      .min(10, 'Reason must be at least 10 characters')
      .max(500, 'Reason cannot exceed 500 characters'),
  }),
});

export const transactionHistorySchema = z.object({
  params: z
    .object({
      userId: mongoIdSchema.optional(),
    })
    .optional(),
  query: z.object({
    type:     z.nativeEnum(TransactionType).optional(),
    source:   z.nativeEnum(TransactionSource).optional(),
    status:   z.nativeEnum(TransactionStatus).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo:   z.coerce.date().optional(),
    page:     z.coerce.number().min(1).default(1),
    limit:    z.coerce.number().min(1).max(100).default(20),
  }),
});

export const getTransactionByIdSchema = z.object({
  params: z.object({
    transactionId: mongoIdSchema,
  }),
});

export type AdjustBalanceInput      = z.infer<typeof adjustBalanceSchema>;
export type GrantBonusInput         = z.infer<typeof grantBonusSchema>;
export type ReverseTransactionInput = z.infer<typeof reverseTransactionSchema>;
export type TransactionHistoryInput = z.infer<typeof transactionHistorySchema>;
export type GetTransactionByIdInput = z.infer<typeof getTransactionByIdSchema>;