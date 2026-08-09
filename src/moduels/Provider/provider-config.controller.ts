import { AsyncHandler } from "@/utils/AsyncHandler.js";
import type { AuthUser } from "../auth/auth.payload.js";
import { errorHandler } from "@/utils/errorHandler.util.js";
import { ServiceConfigModel } from "../service-config/service-config.model.js";
import { successHandler } from "@/utils/successHandler.util.js";
import { ProviderHealthStatus, ProviderName } from "./provider-config.types.js";

// toggleProviderStatus

export const toggleProviderStatus = AsyncHandler(async (req, res, next) => {
  const adminId = (req.user as AuthUser).id;

  if (!adminId) {
    return errorHandler(res, 401, false, "Unauthorized", next);
  }

  const { service, provider } = req.params;
  const { enabled } = req.body;

  if (!Object.values(ProviderName).includes(provider as ProviderName)) {
  return errorHandler(
    res,
    400,
    false,
    "Invalid provider",
    next,
  );
}

  if (typeof enabled !== "boolean") {
    return errorHandler(res, 400, false, "enabled must be a boolean", next);
  }

  const serviceDoc = await ServiceConfigModel.findOne({ service });

  // console.log("service Doc :", serviceDoc);

  if (!serviceDoc) {
    return errorHandler(res, 404, false, "Service not found", next);
  }

  const providerDoc = serviceDoc.providers.find(
    (p: any) => p.provider === provider,
  );

  // console.log("provider Doc :", providerDoc);

  if (!providerDoc) {
    return errorHandler(res, 404, false, "Provider not found", next);
  }

  // Prevent disabling the last active provider while service is enabled
  if (enabled === false && serviceDoc.enabled) {
    const remainingActive = serviceDoc.providers.filter(
      (p: any) => p.enabled && p.provider !== provider,
    );

    if (remainingActive.length === 0) {
      return errorHandler(
        res,
        400,
        false,
        "Cannot disable the last active provider while the service is enabled",
        next,
      );
    }
  }

  providerDoc.enabled = enabled;
  await serviceDoc.save();

  return successHandler(
    res,
    200,
    true,
    `Provider ${enabled ? "enabled" : "disabled"} successfully`,
    { serviceDoc },
  );
});

// updateProviderPriority

export const updateProviderPriority = AsyncHandler(async (req, res, next) => {
  const adminId = (req.user as AuthUser).id;

  if (!adminId) {
    return errorHandler(res, 401, false, "Unauthorized", next);
  }

  const { service, provider } = req.params;
  const { priority } = req.body;

  if (typeof priority !== "number" || Number.isNaN(priority) || priority < 1) {
    return errorHandler(
      res,
      400,
      false,
      "Priority must be a positive number",
      next,
    );
  }

  const serviceDoc = await ServiceConfigModel.findOne({ service });

  if (!serviceDoc) {
    return errorHandler(res, 404, false, "Service not found", next);
  }

  const providerDoc = serviceDoc.providers.find(
    (p: any) => p.provider === provider,
  );

  if (!providerDoc) {
    return errorHandler(res, 404, false, "Provider not found", next);
  }

  // Prevent duplicate priority across other providers
  const priorityTaken = serviceDoc.providers.find(
    (p: any) => p.priority === priority && p.provider !== provider,
  );

  if (priorityTaken) {
    return errorHandler(
      res,
      400,
      false,
      `Priority ${priority} is already assigned to provider '${priorityTaken.provider}'`,
      next,
    );
  }

  providerDoc.priority = priority;

  // Re-sort providers by priority after update
  serviceDoc.providers.sort((a: any, b: any) => a.priority - b.priority);

  await serviceDoc.save();

  return successHandler(
    res,
    200,
    true,
    "Provider priority updated successfully",
    { serviceDoc },
  );
});

// updateProviderModel

export const updateProviderModel = AsyncHandler(async (req, res, next) => {
  const adminId = (req.user as AuthUser).id;

  if (!adminId) {
    return errorHandler(res, 401, false, "Unauthorized", next);
  }

  const { service, provider } = req.params;
  const { model } = req.body;

  if (!model || typeof model !== "string" || model.trim() === "") {
    return errorHandler(
      res,
      400,
      false,
      "A valid model string is required",
      next,
    );
  }

  const updatedService = await ServiceConfigModel.findOneAndUpdate(
    {
      service,
      "providers.provider": provider,
    },
    {
      $set: { "providers.$.model": model.trim() },
    },
    { new: true, runValidators: true },
  );

  if (!updatedService) {
    return errorHandler(res, 404, false, "Service or provider not found", next);
  }

  return successHandler(res, 200, true, "Provider model updated successfully", {
    updatedService,
  });
});

// updateProviderTimeout

export const updateProviderTimeout = AsyncHandler(async (req, res, next) => {
  const adminId = (req.user as AuthUser).id;

  if (!adminId) {
    return errorHandler(res, 401, false, "Unauthorized", next);
  }

  const { service, provider } = req.params;
  const { timeout } = req.body;

  if (
  typeof timeout !== "number" ||
  Number.isNaN(timeout) ||
  timeout < 1000
) {
    return errorHandler(
      res,
      400,
      false,
      "Timeout must be at least 1000ms",
      next,
    );
  }

  const updatedService = await ServiceConfigModel.findOneAndUpdate(
    {
      service,
      "providers.provider": provider,
    },
    {
      $set: { "providers.$.timeout": timeout },
    },
    { new: true, runValidators: true },
  );

  if (!updatedService) {
    return errorHandler(res, 404, false, "Service or provider not found", next);
  }

  return successHandler(
    res,
    200,
    true,
    "Provider timeout updated successfully",
    { updatedService },
  );
});

// updateProviderRetries

export const updateProviderRetries = AsyncHandler(async (req, res, next) => {
  const adminId = (req.user as AuthUser).id;

  if (!adminId) {
    return errorHandler(res, 401, false, "Unauthorized", next);
  }

  const { service, provider } = req.params;
  const { maxRetries } = req.body;

  if (
  typeof maxRetries !== "number" ||
  Number.isNaN(maxRetries) ||
  maxRetries < 0
) {
    return errorHandler(
      res,
      400,
      false,
      "maxRetries must be 0 or greater",
      next,
    );
  }

  const updatedService = await ServiceConfigModel.findOneAndUpdate(
    {
      service,
      "providers.provider": provider,
    },
    {
      $set: { "providers.$.maxRetries": maxRetries },
    },
    { new: true, runValidators: true },
  );

  if (!updatedService) {
    return errorHandler(res, 404, false, "Service or provider not found", next);
  }

  return successHandler(
    res,
    200,
    true,
    "Provider retries updated successfully",
    { updatedService },
  );
});

// updateProviderHealth

export const updateProviderHealth = AsyncHandler(async (req, res, next) => {
  const adminId = (req.user as AuthUser).id;

  if (!adminId) {
    return errorHandler(res, 401, false, "Unauthorized", next);
  }

  const { service, provider } = req.params;
  const { healthStatus, averageResponseTime } = req.body;

  const validStatuses = Object.values(ProviderHealthStatus);

  if (!healthStatus || !validStatuses.includes(healthStatus)) {
    return errorHandler(
      res,
      400,
      false,
      `healthStatus must be one of: ${validStatuses.join(", ")}`,
      next,
    );
  }

  const updateFields: Record<string, unknown> = {
    "providers.$.healthStatus": healthStatus,
    "providers.$.lastCheckedAt": new Date(),
  };

  // Record failure timestamp when health is degraded or down
  if (
    healthStatus === ProviderHealthStatus.Degraded ||
    healthStatus === ProviderHealthStatus.Unhealthy
  ) {
    updateFields["providers.$.lastFailureAt"] = new Date();
  }

  // Update average response time if provided
if (
  averageResponseTime !== undefined &&
  (
    typeof averageResponseTime !== "number" ||
    averageResponseTime < 0
  )
) {
  return errorHandler(
    res,
    400,
    false,
    "averageResponseTime must be a positive number",
    next,
  );
}

  const updatedService = await ServiceConfigModel.findOneAndUpdate(
    {
      service,
      "providers.provider": provider,
    },
    {
      $set: updateFields,
    },
    { new: true, runValidators: true },
  );

  if (!updatedService) {
    return errorHandler(res, 404, false, "Service or provider not found", next);
  }

  return successHandler(
    res,
    200,
    true,
    "Provider health updated successfully",
    { updatedService },
  );
});
