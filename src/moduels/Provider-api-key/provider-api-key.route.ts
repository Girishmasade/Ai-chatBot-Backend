import { authMiddleware, isAdmin } from "@/middlewares/auth.middleware.js";
import { validate } from "@/middlewares/zod.middleware.js";
import { Router } from "express";
import {
  createProviderApiKeySchema,
  providerParamSchema,
  toggleProviderApiKeySchema,
  updateProviderApiKeySchema,
} from "./provider-api-key.validator.js";
import {
  createProviderApiKey,
  deleteProviderApiKey,
  getAllProviderApiKeys,
  getProviderApiKeyByProvider,
  toggleProviderApiKey,
  updateProviderApiKey,
  verifyProviderApiKey,
} from "./provider-api-key.controller.js";

export const providerApiKeyRoute = Router();

// for only un auth users

providerApiKeyRoute.use(authMiddleware, isAdmin);

// routes for only auth users

providerApiKeyRoute.post(
  "/create-api-key",
  validate(createProviderApiKeySchema),
  createProviderApiKey,
);

providerApiKeyRoute.post(
  "/:provider/verify",
  validate(providerParamSchema),
  verifyProviderApiKey,
);

providerApiKeyRoute.get("/", getAllProviderApiKeys);

providerApiKeyRoute.get(
  "/:provider",
  validate(providerParamSchema),
  getProviderApiKeyByProvider,
);

providerApiKeyRoute.patch(
  "/:provider",
  validate(updateProviderApiKeySchema),
  updateProviderApiKey,
);

providerApiKeyRoute.patch(
  "/:provider/toggle",
  validate(toggleProviderApiKeySchema),
  toggleProviderApiKey,
);

providerApiKeyRoute.delete(
  "/:provider",
  validate(providerParamSchema),
  deleteProviderApiKey,
);
