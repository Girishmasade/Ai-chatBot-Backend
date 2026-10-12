import type { Request, Response, NextFunction } from "express";
import { AsyncHandler } from "@/utils/AsyncHandler.js";
import { successHandler } from "@/utils/successHandler.util.js";
import { errorHandler } from "@/utils/errorHandler.util.js";
import redisClient from "@/config/redis.config.js";
import { uploadFile, deleteFile } from "@/utils/cloudinary.util.js";
import { AuditLogModel } from "../admin/auditLog.model.js";
import { emitAdminEntityUpdate } from "@/socket/socket.emitter.js";
import { PrivacyPolicyModel, type IPrivacyPolicy } from "./privacyPolicy.model.js";
import { defaultPrivacyPolicy } from "./privacyPolicy.default.js";

const PRIVACY_CACHE_KEY = "cache:privacy:current";
const PRIVACY_CACHE_TTL = 300; // 5 minutes

// Helper to safely parse JSON strings or return original values
function safeJsonParse<T>(value: any, fallback: T): T {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// USER / PUBLIC CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get current active Privacy Policy
 * Cached in Redis. Falls back to seeding default policy if none exists in database.
 */
export const getCurrentPrivacyPolicy = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // 1. Try Redis cache
    try {
      const cached = await redisClient.get(PRIVACY_CACHE_KEY);
      if (cached) {
        return successHandler(res, 200, true, "Current privacy policy fetched (cached)", {
          policy: JSON.parse(cached),
        });
      }
    } catch (cacheErr) {
      console.warn("[Privacy] Redis cache read warning:", cacheErr);
    }

    // 2. Fetch from database (prefer isCurrent: true and published)
    let policy = await PrivacyPolicyModel.findOne({
      isCurrent: true,
      status: "published",
    }).lean();

    // 3. Fallback to latest published if no current is explicitly flagged
    if (!policy) {
      policy = await PrivacyPolicyModel.findOne({ status: "published" })
        .sort({ createdAt: -1 })
        .lean();
    }

    // 4. Auto-seed default policy if database is completely empty
    if (!policy) {
      const totalCount = await PrivacyPolicyModel.countDocuments();
      if (totalCount === 0) {
        const created = await PrivacyPolicyModel.create(defaultPrivacyPolicy);
        policy = created.toObject();
        console.log("✅ [Privacy] Automatically seeded default GoChat AI privacy policy");
      }
    }

    if (!policy) {
      return errorHandler(res, 404, false, "No published privacy policy found", {});
    }

    // 5. Cache result
    try {
      await redisClient.setEx(PRIVACY_CACHE_KEY, PRIVACY_CACHE_TTL, JSON.stringify(policy));
    } catch (cacheErr) {
      console.warn("[Privacy] Redis cache write warning:", cacheErr);
    }

    return successHandler(res, 200, true, "Current privacy policy fetched successfully", {
      policy,
    });
  }
);

/**
 * Get a specific Privacy Policy by version or slug
 */
export const getPrivacyPolicyBySlugOrVersion = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { slugOrVersion } = req.params;
    const isAdminUser = (req.user as any)?.role === "admin";

    // Query condition: match slug or version
    const query: any = {
      $or: [{ slug: slugOrVersion }, { version: slugOrVersion }],
    };

    // Non-admins can only view published policies
    if (!isAdminUser) {
      query.status = "published";
    }

    const policy = await PrivacyPolicyModel.findOne(query).lean();
    if (!policy) {
      return errorHandler(res, 404, false, "Privacy policy revision not found", {});
    }

    return successHandler(res, 200, true, "Privacy policy fetched successfully", {
      policy,
    });
  }
);

/**
 * Get revision history of all published Privacy Policies (publicly visible)
 */
export const getPrivacyPolicyHistory = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const history = await PrivacyPolicyModel.find({ status: "published" })
      .select("_id title slug version effectiveDate lastUpdated summary isCurrent changelog bannerImage createdAt")
      .sort({ effectiveDate: -1, createdAt: -1 })
      .lean();

    return successHandler(res, 200, true, "Privacy policy history fetched", {
      history,
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all privacy policies (drafts, published, archived) with pagination & filtering
 */
export const getAllPrivacyPolicies = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
    const status = req.query.status as string;
    const search = req.query.search as string;

    const filter: any = {};
    if (status && ["draft", "published", "archived"].includes(status)) {
      filter.status = status;
    }
    if (search && search.trim()) {
      filter.$or = [
        { title: { $regex: search.trim(), $options: "i" } },
        { version: { $regex: search.trim(), $options: "i" } },
        { summary: { $regex: search.trim(), $options: "i" } },
      ];
    }

    const [total, policies] = await Promise.all([
      PrivacyPolicyModel.countDocuments(filter),
      PrivacyPolicyModel.find(filter)
        .populate("createdBy", "username email avatar")
        .populate("updatedBy", "username email avatar")
        .sort({ isCurrent: -1, effectiveDate: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return successHandler(res, 200, true, "Admin privacy policies fetched", {
      policies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  }
);

/**
 * Get a single privacy policy by ID (Admin)
 */
export const getPrivacyPolicyById = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const policy = await PrivacyPolicyModel.findById(id)
      .populate("createdBy", "username email avatar")
      .populate("updatedBy", "username email avatar");

    if (!policy) {
      return errorHandler(res, 404, false, "Privacy policy not found", {});
    }

    return successHandler(res, 200, true, "Privacy policy details fetched", {
      policy,
    });
  }
);

/**
 * Create a new Privacy Policy version (Admin)
 * Supports file upload for banner image via Multer or image URL/base64 in body
 */
export const createPrivacyPolicy = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const operator = (req.user as any)?.username || "Admin";
    const userId = (req.user as any)?.id;

    const bodyData = { ...req.body };

    // Handle uploaded banner image file via multer
    let bannerImage: any = safeJsonParse(bodyData.bannerImage, undefined);
    if (req.file) {
      bannerImage = {
        url: (req.file as any).path || (req.file as any).secure_url,
        publicId: (req.file as any).filename || (req.file as any).public_id || "",
        caption: bodyData.bannerCaption || bodyData.caption || "",
      };
    } else if (bodyData.imageUrl || bodyData.bannerImageUrl) {
      const rawUrl = bodyData.imageUrl || bodyData.bannerImageUrl;
      if (rawUrl.startsWith("data:") || rawUrl.startsWith("http")) {
        try {
          const uploaded = await uploadFile(rawUrl, "privacy", "image");
          bannerImage = {
            url: uploaded.secure_url,
            publicId: uploaded.public_id,
            caption: bodyData.bannerCaption || bodyData.caption || "",
          };
        } catch (uploadErr: any) {
          console.warn("[Privacy] Cloudinary banner upload error:", uploadErr?.message);
        }
      }
    }

    // Safely parse JSON array / object fields from form-data if needed
    const sections = safeJsonParse(bodyData.sections, []);
    const thirdPartyProcessors = safeJsonParse(bodyData.thirdPartyProcessors, []);
    const userRights = safeJsonParse(bodyData.userRights, []);
    const securityMeasures = safeJsonParse(bodyData.securityMeasures, []);

    const isCurrent =
      bodyData.isCurrent === true ||
      bodyData.isCurrent === "true" ||
      bodyData.isCurrent === 1;

    // Check if there are existing policies
    const existingCount = await PrivacyPolicyModel.countDocuments();
    const shouldBeCurrent = isCurrent || existingCount === 0;

    // If marked as current, deactivate all other current policies
    if (shouldBeCurrent) {
      await PrivacyPolicyModel.updateMany({ isCurrent: true }, { isCurrent: false });
    }

    const newPolicy = await PrivacyPolicyModel.create({
      title: bodyData.title || "GoChat AI Privacy Policy",
      slug: bodyData.slug || "privacy-policy",
      version: bodyData.version || "1.0.0",
      summary: bodyData.summary || "",
      content: bodyData.content || "",
      status: bodyData.status || "published",
      isCurrent: shouldBeCurrent,
      effectiveDate: bodyData.effectiveDate ? new Date(bodyData.effectiveDate) : new Date(),
      lastUpdated: new Date(),
      bannerImage: bannerImage || undefined,
      sections: Array.isArray(sections) ? sections : [],
      thirdPartyProcessors: Array.isArray(thirdPartyProcessors) ? thirdPartyProcessors : [],
      userRights: Array.isArray(userRights) ? userRights : [],
      securityMeasures: Array.isArray(securityMeasures) ? securityMeasures : [],
      contactEmail: bodyData.contactEmail || "privacy@gochat.ai",
      retentionPeriod: bodyData.retentionPeriod || "",
      cookiePolicySummary: bodyData.cookiePolicySummary || "",
      changelog: bodyData.changelog || "",
      createdBy: userId,
      updatedBy: userId,
    });

    // Invalidate Redis cache
    try {
      await redisClient.del(PRIVACY_CACHE_KEY);
    } catch (cacheErr) {
      console.warn("[Privacy] Cache invalidation warning:", cacheErr);
    }

    // Audit log
    await AuditLogModel.create({
      action: "Privacy Policy Created",
      operator,
      details: `Created Privacy Policy v${newPolicy.version} ("${newPolicy.title}") - Status: ${newPolicy.status}`,
      level: "info",
    });

    // Real-time socket notification
    emitAdminEntityUpdate({
      entityType: "config",
      action: "created",
      data: newPolicy,
    });

    return successHandler(res, 201, true, "Privacy policy created successfully", {
      policy: newPolicy,
    });
  }
);

/**
 * Update an existing Privacy Policy (Admin)
 * Supports updating banner image or modifying text, sections, and metadata
 */
export const updatePrivacyPolicy = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const operator = (req.user as any)?.username || "Admin";
    const userId = (req.user as any)?.id;

    const policy = await PrivacyPolicyModel.findById(id);
    if (!policy) {
      return errorHandler(res, 404, false, "Privacy policy not found", {});
    }

    const bodyData = { ...req.body };

    // Handle new uploaded banner image file
    if (req.file) {
      // If previous banner had a Cloudinary publicId, remove old asset
      if (policy.bannerImage?.publicId) {
        try {
          await deleteFile(policy.bannerImage.publicId, "image");
        } catch (delErr: any) {
          console.warn("[Privacy] Failed to delete old Cloudinary banner:", delErr?.message);
        }
      }

      policy.bannerImage = {
        url: (req.file as any).path || (req.file as any).secure_url,
        publicId: (req.file as any).filename || (req.file as any).public_id || "",
        caption: bodyData.bannerCaption || bodyData.caption || policy.bannerImage?.caption || "",
      };
    } else if (bodyData.imageUrl || bodyData.bannerImageUrl) {
      const rawUrl = bodyData.imageUrl || bodyData.bannerImageUrl;
      if (rawUrl.startsWith("data:") || rawUrl.startsWith("http")) {
        try {
          const uploaded = await uploadFile(rawUrl, "privacy", "image");
          if (policy.bannerImage?.publicId) {
            try {
              await deleteFile(policy.bannerImage.publicId, "image");
            } catch {}
          }
          policy.bannerImage = {
            url: uploaded.secure_url,
            publicId: uploaded.public_id,
            caption: bodyData.bannerCaption || bodyData.caption || "",
          };
        } catch (uploadErr: any) {
          console.warn("[Privacy] Cloudinary banner upload error:", uploadErr?.message);
        }
      }
    } else if (bodyData.bannerImage !== undefined) {
      policy.bannerImage = safeJsonParse(bodyData.bannerImage, policy.bannerImage);
    }

    // Update primitive text fields if provided
    if (bodyData.title !== undefined) policy.title = bodyData.title;
    if (bodyData.slug !== undefined) policy.slug = bodyData.slug;
    if (bodyData.version !== undefined) policy.version = bodyData.version;
    if (bodyData.summary !== undefined) policy.summary = bodyData.summary;
    if (bodyData.content !== undefined) policy.content = bodyData.content;
    if (bodyData.status !== undefined) policy.status = bodyData.status;
    if (bodyData.effectiveDate !== undefined) policy.effectiveDate = new Date(bodyData.effectiveDate);
    if (bodyData.contactEmail !== undefined) policy.contactEmail = bodyData.contactEmail;
    if (bodyData.retentionPeriod !== undefined) policy.retentionPeriod = bodyData.retentionPeriod;
    if (bodyData.cookiePolicySummary !== undefined) policy.cookiePolicySummary = bodyData.cookiePolicySummary;
    if (bodyData.changelog !== undefined) policy.changelog = bodyData.changelog;

    // Update complex fields
    if (bodyData.sections !== undefined) {
      policy.sections = safeJsonParse(bodyData.sections, policy.sections);
    }
    if (bodyData.thirdPartyProcessors !== undefined) {
      policy.thirdPartyProcessors = safeJsonParse(bodyData.thirdPartyProcessors, policy.thirdPartyProcessors);
    }
    if (bodyData.userRights !== undefined) {
      policy.userRights = safeJsonParse(bodyData.userRights, policy.userRights);
    }
    if (bodyData.securityMeasures !== undefined) {
      policy.securityMeasures = safeJsonParse(bodyData.securityMeasures, policy.securityMeasures);
    }

    // Handle isCurrent change
    const isCurrentRequested =
      bodyData.isCurrent === true ||
      bodyData.isCurrent === "true" ||
      bodyData.isCurrent === 1;

    if (bodyData.isCurrent !== undefined) {
      if (isCurrentRequested && !policy.isCurrent) {
        await PrivacyPolicyModel.updateMany({ _id: { $ne: policy._id }, isCurrent: true }, { isCurrent: false });
        policy.isCurrent = true;
        policy.status = "published";
      } else if (!isCurrentRequested && policy.isCurrent) {
        policy.isCurrent = false;
      }
    }

    policy.lastUpdated = new Date();
    policy.updatedBy = userId;

    await policy.save();

    // Clear Redis cache
    try {
      await redisClient.del(PRIVACY_CACHE_KEY);
    } catch (cacheErr) {
      console.warn("[Privacy] Cache invalidation warning:", cacheErr);
    }

    // Audit log
    await AuditLogModel.create({
      action: "Privacy Policy Updated",
      operator,
      details: `Updated Privacy Policy v${policy.version} ("${policy.title}")`,
      level: "info",
    });

    // Real-time socket notification
    emitAdminEntityUpdate({
      entityType: "config",
      action: "updated",
      data: policy,
    });

    return successHandler(res, 200, true, "Privacy policy updated successfully", {
      policy,
    });
  }
);

/**
 * Set a specific policy as the current active version (Admin)
 */
export const setAsCurrentPrivacyPolicy = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const operator = (req.user as any)?.username || "Admin";

    const policy = await PrivacyPolicyModel.findById(id);
    if (!policy) {
      return errorHandler(res, 404, false, "Privacy policy not found", {});
    }

    // Unset all others
    await PrivacyPolicyModel.updateMany({ _id: { $ne: policy._id }, isCurrent: true }, { isCurrent: false });

    policy.isCurrent = true;
    policy.status = "published";
    policy.lastUpdated = new Date();
    policy.updatedBy = (req.user as any)?.id;
    await policy.save();

    try {
      await redisClient.del(PRIVACY_CACHE_KEY);
    } catch (cacheErr) {
      console.warn("[Privacy] Cache invalidation warning:", cacheErr);
    }

    await AuditLogModel.create({
      action: "Privacy Policy Activated",
      operator,
      details: `Set Privacy Policy v${policy.version} as the active current policy`,
      level: "info",
    });

    emitAdminEntityUpdate({
      entityType: "config",
      action: "updated",
      data: policy,
    });

    return successHandler(res, 200, true, "Policy set as current active privacy policy", {
      policy,
    });
  }
);

/**
 * Delete a Privacy Policy (Admin)
 */
export const deletePrivacyPolicy = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const operator = (req.user as any)?.username || "Admin";

    const policy = await PrivacyPolicyModel.findById(id);
    if (!policy) {
      return errorHandler(res, 404, false, "Privacy policy not found", {});
    }

    const totalPolicies = await PrivacyPolicyModel.countDocuments();
    if (totalPolicies <= 1) {
      return errorHandler(
        res,
        400,
        false,
        "Cannot delete the only remaining privacy policy. Edit or replace it instead.",
        {}
      );
    }

    // If deleting the active policy, promote another published policy
    if (policy.isCurrent) {
      const nextPolicy = await PrivacyPolicyModel.findOne({
        _id: { $ne: policy._id },
        status: "published",
      }).sort({ createdAt: -1 });

      if (nextPolicy) {
        nextPolicy.isCurrent = true;
        await nextPolicy.save();
      }
    }

    // Delete image from Cloudinary if stored
    if (policy.bannerImage?.publicId) {
      try {
        await deleteFile(policy.bannerImage.publicId, "image");
      } catch (delErr: any) {
        console.warn("[Privacy] Cloudinary banner deletion warning:", delErr?.message);
      }
    }

    await PrivacyPolicyModel.findByIdAndDelete(id);

    try {
      await redisClient.del(PRIVACY_CACHE_KEY);
    } catch (cacheErr) {
      console.warn("[Privacy] Cache invalidation warning:", cacheErr);
    }

    await AuditLogModel.create({
      action: "Privacy Policy Deleted",
      operator,
      details: `Deleted Privacy Policy v${policy.version} ("${policy.title}")`,
      level: "warning",
    });

    emitAdminEntityUpdate({
      entityType: "config",
      action: "deleted",
      data: { id, version: policy.version },
    });

    return successHandler(res, 200, true, "Privacy policy deleted successfully", {
      deletedId: id,
    });
  }
);

/**
 * Standalone image upload for Privacy Policy (Admin)
 * Uploads section illustrations, icons, or banners to Cloudinary
 */
export const uploadPolicyImage = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    let url = "";
    let publicId = "";

    if (req.file) {
      url = (req.file as any).path || (req.file as any).secure_url;
      publicId = (req.file as any).filename || (req.file as any).public_id || "";
    } else if (req.body.imageUrl) {
      const uploadRes = await uploadFile(req.body.imageUrl, "privacy", "image");
      url = uploadRes.secure_url;
      publicId = uploadRes.public_id;
    } else {
      return errorHandler(res, 400, false, "No image file or image URL provided", {});
    }

    return successHandler(res, 200, true, "Image uploaded successfully for privacy policy", {
      url,
      publicId,
      caption: req.body.caption || "",
    });
  }
);

/**
 * Seed or reset the default GoChat AI privacy policy (Admin)
 */
export const seedDefaultPrivacyPolicy = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const operator = (req.user as any)?.username || "Admin";

    // Set other policies isCurrent: false
    await PrivacyPolicyModel.updateMany({ isCurrent: true }, { isCurrent: false });

    const seeded = await PrivacyPolicyModel.create({
      ...defaultPrivacyPolicy,
      createdBy: (req.user as any)?.id,
      updatedBy: (req.user as any)?.id,
      lastUpdated: new Date(),
    });

    try {
      await redisClient.del(PRIVACY_CACHE_KEY);
    } catch (cacheErr) {
      console.warn("[Privacy] Cache invalidation warning:", cacheErr);
    }

    await AuditLogModel.create({
      action: "Privacy Policy Seeded",
      operator,
      details: `Seeded default GoChat AI Privacy Policy v${seeded.version}`,
      level: "info",
    });

    emitAdminEntityUpdate({
      entityType: "config",
      action: "created",
      data: seeded,
    });

    return successHandler(res, 201, true, "Default privacy policy seeded successfully", {
      policy: seeded,
    });
  }
);
