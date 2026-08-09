import { z } from "zod";

export const createTokenSchema = z.object({
  body: z.object({
    name: z.string().min(3).max(100),

    description: z.string().optional(),

    tokens: z.number().positive(),

    price: z.number().nonnegative(),

    currency: z.string().default("inr"),

    isActive: z.boolean().optional(),
  }),
});

export const updateTokenSchema = z.object({
  body: z.object({
    name: z.string().min(3).max(100).optional(),

    description: z.string().optional(),

    tokens: z.number().positive().optional(),

    price: z.number().nonnegative().optional(),

    currency: z.string().optional(),

    isActive: z.boolean().optional(),
  }),
});
