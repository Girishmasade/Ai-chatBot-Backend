import z from "zod";

// admin side subscription model

export const subscriptionSchema = z.object({
    name: z.string(),
    plan: z.string(),
    price: z.number(),
    description: z.string(),
    services: z.array(z.string()),
    isActive: z.boolean(),
    createdBy: z.string(),
})

export const createSub = subscriptionSchema.extend({ // extend is used to add or modify fields in the schema
    name: z.string().optional(),
    plan: z.string().optional(),
    price: z.number().optional(),
    description: z.string().optional(),
    services: z.array(z.string()).optional(),
    isActive: z.boolean().optional(),
    createdBy: z.string().optional()
})

export const updateSub = subscriptionSchema.extend({
    name: z.string().optional(),
    plan: z.string().optional(),
    price: z.number().optional(),
    description: z.string().optional(),
    services: z.array(z.string()).optional(),
    isActive: z.boolean().optional(),
    createdBy: z.string().optional()
})

// user side subscription model

export const userSubscriptionSchema = z.object({
    user: z.string(),
    plan: z.string(),
    status: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    paymentRef: z.string(),
    activatedAt: z.string(),
    cancelledAt: z.string()
})

export const createUserSubscription = userSubscriptionSchema.extend({ // extend is used to add or modify fields in the schema
    user: z.string().optional(),
    plan: z.string().optional(),
    status: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    paymentRef: z.string().optional(),
    activatedAt: z.string().optional(),
    cancelledAt: z.string().optional()
})

export const updateUserSubscription = userSubscriptionSchema.extend({
    user: z.string().optional(),
    plan: z.string().optional(),
    status: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    paymentRef: z.string().optional(),
    activatedAt: z.string().optional(),
    cancelledAt: z.string().optional()
})

export const cancelUserSubscription = userSubscriptionSchema.extend({
    user: z.string().optional(),
    plan: z.string().optional(),
    status: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    paymentRef: z.string().optional(),
    activatedAt: z.string().optional(),
    cancelledAt: z.string().optional()
})