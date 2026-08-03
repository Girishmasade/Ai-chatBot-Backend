import { authMiddleware, isAdmin } from "@/middlewares/auth.middleware.js";
import { Router } from "express";
import {
  toggleProviderStatus,
  updateProviderHealth,
  updateProviderModel,
  updateProviderPriority,
  updateProviderRetries,
  updateProviderTimeout,
} from "./provider-config.controller.js";
import { validate } from "@/middlewares/zod.middleware.js";
import {
  toggleProviderSchema,
  updateProviderHealthSchema,
  updateProviderModelSchema,
  updateProviderPrioritySchema,
  updateProviderRetriesSchema,
  updateProviderTimeoutSchema,
} from "./provider-config.validator.js";

export const providerRouter = Router({ mergeParams: true }); // the merge params is used to merge the params of the parent router with the child router

providerRouter.use(authMiddleware, isAdmin);

// toggle provider route

providerRouter.patch(
  "/:provider/toggle",
  validate(toggleProviderSchema),
  toggleProviderStatus,
);

// update provider priority route

providerRouter.patch(
  "/:provider/priority",
  validate(updateProviderPrioritySchema),
  updateProviderPriority,
);

// model api

providerRouter.patch(
  "/:provider/model",
  validate(updateProviderModelSchema),
  updateProviderModel,
);

// timeout api

providerRouter.patch(
  "/:provider/timeout",
  validate(updateProviderTimeoutSchema),
  updateProviderTimeout,
);

// retries api

providerRouter.patch(
  "/:provider/retries",
  validate(updateProviderRetriesSchema),
  updateProviderRetries,
);

// heatlh api

providerRouter.patch(
  "/:provider/health",
  validate(updateProviderHealthSchema),
  updateProviderHealth,
);
