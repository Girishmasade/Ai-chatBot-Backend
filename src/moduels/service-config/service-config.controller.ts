import { AsyncHandler } from "@/utils/AsyncHandler.js";
import type { AuthUser } from "../auth/auth.payload.js";
import { errorHandler } from "@/utils/errorHandler.util.js";
import { ServiceConfigModel } from "./service-config.model.js";
import { successHandler } from "@/utils/successHandler.util.js";
import redisClient from "@/config/redis.config.js";

const refreshServiceCache = async (): Promise<void> => {
  const services = await ServiceConfigModel.find().lean();
  await redisClient.set("service:list", JSON.stringify(services));
};

// createServiceConfig

export const createServiceConfig = AsyncHandler(async (req, res, next) => {
  const adminId = (req.user as AuthUser).id;

  if (!adminId) {
    return errorHandler(res, 401, false, "Unauthorized", next);
  }

  const {
    service,
    enabled,
    fallbackEnabled,
    cacheEnabled,
    providers,
    rateLimitPerMinute,
  } = req.body;

  if (!service || !providers || providers.length === 0) {
    return errorHandler(
      res,
      400,
      false,
      "Service name and at least one provider are required",
      next,
    );
  }

  const isServiceConfigExist = await ServiceConfigModel.findOne({
    service: service.toLowerCase(),
  });

  // console.log("is service config exists :", isServiceConfigExist)

  if (isServiceConfigExist) {
    return errorHandler(
      res,
      400,
      false,
      `Service config for '${service}' already exists`,
      next,
    );
  }

  const newServiceConfig = await ServiceConfigModel.create({
    service: service.toLowerCase(),
    enabled: enabled ?? true,
    fallbackEnabled: fallbackEnabled ?? true,
    cacheEnabled: cacheEnabled ?? true,
    providers,
    rateLimitPerMinute: rateLimitPerMinute ?? 60,
  });

  // console.log("new service config",newServiceConfig);

  await refreshServiceCache();

  return successHandler(
    res,
    201,
    true,
    "Service config created successfully",
    {newServiceConfig},
  );
});

// updateServiceConfig

export const updateServiceConfig = AsyncHandler(async (req, res, next) => {
  const adminId = (req.user as AuthUser).id;

  if (!adminId) {
    return errorHandler(res, 401, false, "Unauthorized", next);
  }

  const { id: service } = req.params;
  const { fallbackEnabled, cacheEnabled, rateLimitPerMinute } = req.body;

  const updateFields: Record<string, unknown> = {};

  if (fallbackEnabled !== undefined) updateFields.fallbackEnabled = fallbackEnabled;
  if (cacheEnabled !== undefined) updateFields.cacheEnabled = cacheEnabled;
  if (rateLimitPerMinute !== undefined) updateFields.rateLimitPerMinute = rateLimitPerMinute;

  if (Object.keys(updateFields).length === 0) {
    return errorHandler(res, 400, false, "No valid fields provided for update", next);
  }

  const updatedService = await ServiceConfigModel.findOneAndUpdate(
    { service },
    { $set: updateFields },
    { new: true, runValidators: true },
  );

  if (!updatedService) {
    return errorHandler(res, 404, false, "Service not found", next);
  }

  await refreshServiceCache();

  return successHandler(
    res,
    200,
    true,
    "Service config updated successfully",
    {updatedService},
  );
});

// getListOfServices

export const getListOfServices = AsyncHandler(async (req, res, next) => {
  const adminId = (req.user as AuthUser).id;

  if (!adminId) {
    return errorHandler(res, 401, false, "Unauthorized", next);
  }

  const cached = await redisClient.get("service:list");

  if (cached) {
    return successHandler(
      res,
      200,
      true,
      "Service list fetched from cache",
      JSON.parse(cached),
    );
  }

  const services = await ServiceConfigModel.find().lean();

  // console.log("services :", services)

  await redisClient.set("service:list", JSON.stringify(services));

  return successHandler(res, 200, true, "Service list fetched", {services});
});

// getSingleService

export const getSingleService = AsyncHandler(async (req, res, next) => {
  const adminId = (req.user as AuthUser).id;

  if (!adminId) {
    return errorHandler(res, 401, false, "Unauthorized", next);
  }

  const { id: service } = req.params;

  const serviceDoc = await ServiceConfigModel.findOne({ service }).lean();

  if (!serviceDoc) {
    return errorHandler(res, 404, false, "Service not found", next);
  }

  return successHandler(res, 200, true, "Service fetched", serviceDoc);
});

// deleteService

export const deleteService = AsyncHandler(async (req, res, next) => {
  const adminId = (req.user as AuthUser).id;

  if (!adminId) {
    return errorHandler(res, 401, false, "Unauthorized", next);
  }

  const { id: service } = req.params;

  const deletedService = await ServiceConfigModel.findOneAndDelete({ service });

  if (!deletedService) {
    return errorHandler(res, 404, false, "Service not found", next);
  }

  await refreshServiceCache();

  return successHandler(res, 200, true, "Service deleted successfully", {});
});

// toggleServiceStatus

export const toggleServiceStatus = AsyncHandler(async (req, res, next) => {
  const adminId = (req.user as AuthUser).id;

  if (!adminId) {
    return errorHandler(res, 401, false, "Unauthorized", next);
  }

  const { id: service } = req.params;
  const { enabled } = req.body;

  if (typeof enabled !== "boolean") {
    return errorHandler(res, 400, false, "enabled must be a boolean", next);
  }

  const serviceDoc = await ServiceConfigModel.findOne({ service });

  if (!serviceDoc) {
    return errorHandler(res, 404, false, "Service not found", next);
  }

  // Prevent enabling a service that has no active providers
  if (enabled === true) {
    const activeProviders = serviceDoc.providers.filter((p: any) => p.enabled);

    if (activeProviders.length === 0) {
      return errorHandler(
        res,
        400,
        false,
        "Cannot enable service: no active providers available",
        next,
      );
    }
  }

  serviceDoc.enabled = enabled;
  await serviceDoc.save();

  await refreshServiceCache();

  return successHandler(
    res,
    200,
    true,
    `Service ${enabled ? "enabled" : "disabled"} successfully`,
    {serviceDoc},
  );
});

// toggleFallbackStatus

export const toggleFallbackStatus = AsyncHandler(async (req, res, next) => {
  const adminId = (req.user as AuthUser).id;

  if (!adminId) {
    return errorHandler(res, 401, false, "Unauthorized", next);
  }

  const { id: service } = req.params;
  const { fallbackEnabled } = req.body;

  if (typeof fallbackEnabled !== "boolean") {
    return errorHandler(res, 400, false, "fallbackEnabled must be a boolean", next);
  }

  const updatedService = await ServiceConfigModel.findOneAndUpdate(
    { service },
    { $set: { fallbackEnabled } },
    { new: true },
  );

  if (!updatedService) {
    return errorHandler(res, 404, false, "Service not found", next);
  }

  await refreshServiceCache();

  return successHandler(
    res,
    200,
    true,
    `Fallback ${fallbackEnabled ? "enabled" : "disabled"} successfully`,
    {updatedService},
  );
});

// updateRateLimit

export const updateRateLimit = AsyncHandler(async (req, res, next) => {
  const adminId = (req.user as AuthUser).id;

  if (!adminId) {
    return errorHandler(res, 401, false, "Unauthorized", next);
  }

  const { id: service } = req.params;
  const { rateLimitPerMinute } = req.body;

  if (!rateLimitPerMinute || rateLimitPerMinute < 1) {
    return errorHandler(
      res,
      400,
      false,
      "rateLimitPerMinute must be at least 1",
      next,
    );
  }

  const updatedService = await ServiceConfigModel.findOneAndUpdate(
    { service },
    { $set: { rateLimitPerMinute } },
    { new: true, runValidators: true },
  );

  if (!updatedService) {
    return errorHandler(res, 404, false, "Service not found", next);
  }

  await refreshServiceCache();

  return successHandler(
    res,
    200,
    true,
    "Rate limit updated successfully",
    {updatedService},
  );
});