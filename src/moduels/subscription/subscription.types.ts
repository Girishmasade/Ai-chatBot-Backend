import type {z} from "zod";

import {
    createSub,
    updateSub,
    createUserSubscription,
    updateUserSubscription,
    cancelUserSubscription,
} from "./subscription.validator.js";

export type CreateSubInput = z.infer<typeof createSub>;
export type UpdateSubInput = z.infer<typeof updateSub>;
export type CreateUserSubscriptionInput = z.infer<typeof createUserSubscription>;
export type UpdateUserSubscriptionInput = z.infer<typeof updateUserSubscription>;
export type CancelUserSubscriptionInput = z.infer<typeof cancelUserSubscription>;
