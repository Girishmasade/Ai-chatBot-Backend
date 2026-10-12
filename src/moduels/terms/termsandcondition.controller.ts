import type { Request, Response, NextFunction } from "express";
import { AsyncHandler } from "@/utils/AsyncHandler.js";
import { successHandler } from "@/utils/successHandler.util.js";
import { errorHandler } from "@/utils/errorHandler.util.js";
import redisClient from "@/config/redis.config.js";
import { uploadFile, deleteFile } from "@/utils/cloudinary.util.js";
import { AuditLogModel } from "../admin/auditLog.model.js";
import { emitAdminEntityUpdate } from "@/socket/socket.emitter.js";
import { TermsAndConditionModel, type ITermsAndCondition } from "./termsandcondition.model.js";
import { defaultTermsAndCondition } from "./termsandcondition.default.js";

const TERMS_CACHE_KEY = "cache:terms:current";
const TERMS_CACHE_TTL = 300; // 5 minutes

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
 * Get current active Terms and Conditions
 * Cached in Redis. Falls back to seeding default terms if none exists in database.
 */
export const getCurrentTermsAndCondition = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    // 1. Try Redis cache
    try {
      const cached = await redisClient.get(TERMS_CACHE_KEY);
      if (cached) {
        return successHandler(res, 200, true, "Current terms fetched (cached)", {
          terms: JSON.parse(cached),
        });
      }
    } catch (cacheErr) {
      console.warn("[Terms] Redis cache read warning:", cacheErr);
    }

    // 2. Fetch from database (prefer isCurrent: true and published)
    let terms = await TermsAndConditionModel.findOne({
      isCurrent: true,
      status: "published",
    }).lean();

    // 3. Fallback to latest published if no current is explicitly flagged
    if (!terms) {
      terms = await TermsAndConditionModel.findOne({ status: "published" })
        .sort({ createdAt: -1 })
        .lean();
    }

    // 4. Auto-seed default terms if database is completely empty
    if (!terms) {
      const totalCount = await TermsAndConditionModel.countDocuments();
      if (totalCount === 0) {
        const created = await TermsAndConditionModel.create(defaultTermsAndCondition);
        terms = created.toObject();
        console.log("✅ [Terms] Automatically seeded default GoChat AI terms and conditions");
      }
    }

    if (!terms) {
      return errorHandler(res, 404, false, "No published terms and conditions found", {});
    }

    // 5. Cache result
    try {
      await redisClient.setEx(TERMS_CACHE_KEY, TERMS_CACHE_TTL, JSON.stringify(terms));
    } catch (cacheErr) {
      console.warn("[Terms] Redis cache write warning:", cacheErr);
    }

    return successHandler(res, 200, true, "Current terms fetched successfully", {
      terms,
    });
  }
);

/**
 * Get a specific Terms and Conditions revision by version or slug
 */
export const getTermsAndConditionBySlugOrVersion = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { slugOrVersion } = req.params;
    const isAdminUser = (req.user as any)?.role === "admin";

    const query: any = {
      $or: [{ slug: slugOrVersion }, { version: slugOrVersion }],
    };

    if (!isAdminUser) {
      query.status = "published";
    }

    const terms = await TermsAndConditionModel.findOne(query).lean();
    if (!terms) {
      return errorHandler(res, 404, false, "Terms revision not found", {});
    }

    return successHandler(res, 200, true, "Terms revision fetched successfully", {
      terms,
    });
  }
);

/**
 * Get revision history of all published Terms and Conditions (publicly visible)
 */
export const getTermsAndConditionHistory = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const history = await TermsAndConditionModel.find({ status: "published" })
      .select("_id title slug version effectiveDate lastUpdated summary isCurrent changelog bannerImage createdAt")
      .sort({ effectiveDate: -1, createdAt: -1 })
      .lean();

    return successHandler(res, 200, true, "Terms revision history fetched", {
      history,
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all Terms and Conditions revisions (Admin) with pagination & search
 */
export const getAllTermsAndConditions = AsyncHandler(
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

    const [total, termsList] = await Promise.all([
      TermsAndConditionModel.countDocuments(filter),
      TermsAndConditionModel.find(filter)
        .populate("createdBy", "username email avatar")
        .populate("updatedBy", "username email avatar")
        .sort({ isCurrent: -1, effectiveDate: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return successHandler(res, 200, true, "Admin terms list fetched", {
      terms: termsList,
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
 * Get single Terms and Conditions by ID (Admin)
 */
export const getTermsAndConditionById = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const terms = await TermsAndConditionModel.findById(id)
      .populate("createdBy", "username email avatar")
      .populate("updatedBy", "username email avatar");

    if (!terms) {
      return errorHandler(res, 404, false, "Terms document not found", {});
    }

    return successHandler(res, 200, true, "Terms details fetched", {
      terms,
    });
  }
);

/**
 * Create a new Terms and Conditions revision (Admin)
 * Supports cover banner upload via Multer or image URL/base64
 */
export const createTermsAndCondition = AsyncHandler(
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
          const uploaded = await uploadFile(rawUrl, "terms", "image");
          bannerImage = {
            url: uploaded.secure_url,
            publicId: uploaded.public_id,
            caption: bodyData.bannerCaption || bodyData.caption || "",
          };
        } catch (uploadErr: any) {
          console.warn("[Terms] Cloudinary banner upload error:", uploadErr?.message);
        }
      }
    }

    // Safely parse JSON array fields
    const sections = safeJsonParse(bodyData.sections, []);
    const keyHighlights = safeJsonParse(bodyData.keyHighlights, []);
    const prohibitedActivities = safeJsonParse(bodyData.prohibitedActivities, []);

    const isCurrent =
      bodyData.isCurrent === true ||
      bodyData.isCurrent === "true" ||
      bodyData.isCurrent === 1;

    const existingCount = await TermsAndConditionModel.countDocuments();
    const shouldBeCurrent = isCurrent || existingCount === 0;

    if (shouldBeCurrent) {
      await TermsAndConditionModel.updateMany({ isCurrent: true }, { isCurrent: false });
    }

    const newTerms = await TermsAndConditionModel.create({
      title: bodyData.title || "GoChat AI Terms and Conditions",
      slug: bodyData.slug || "terms-and-conditions",
      version: bodyData.version || "1.0.0",
      summary: bodyData.summary || "",
      content: bodyData.content || "",
      status: bodyData.status || "published",
      isCurrent: shouldBeCurrent,
      effectiveDate: bodyData.effectiveDate ? new Date(bodyData.effectiveDate) : new Date(),
      lastUpdated: new Date(),
      bannerImage: bannerImage || undefined,
      sections: Array.isArray(sections) ? sections : [],
      keyHighlights: Array.isArray(keyHighlights) ? keyHighlights : [],
      prohibitedActivities: Array.isArray(prohibitedActivities) ? prohibitedActivities : [],
      governingLaw: bodyData.governingLaw || "Laws of India / Standard Enterprise Jurisdiction",
      contactEmail: bodyData.contactEmail || "legal@gochat.ai",
      changelog: bodyData.changelog || "",
      createdBy: userId,
      updatedBy: userId,
    });

    try {
      await redisClient.del(TERMS_CACHE_KEY);
    } catch (cacheErr) {
      console.warn("[Terms] Cache invalidation warning:", cacheErr);
    }

    await AuditLogModel.create({
      action: "Terms and Conditions Created",
      operator,
      details: `Created Terms & Conditions v${newTerms.version} ("${newTerms.title}") - Status: ${newTerms.status}`,
      level: "info",
    });

    emitAdminEntityUpdate({
      entityType: "config",
      action: "created",
      data: newTerms,
    });

    return successHandler(res, 201, true, "Terms and conditions created successfully", {
      terms: newTerms,
    });
  }
);

/**
 * Update an existing Terms and Conditions revision (Admin)
 */
export const updateTermsAndCondition = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const operator = (req.user as any)?.username || "Admin";
    const userId = (req.user as any)?.id;

    const terms = await TermsAndConditionModel.findById(id);
    if (!terms) {
      return errorHandler(res, 404, false, "Terms and conditions document not found", {});
    }

    const bodyData = { ...req.body };

    // Handle new uploaded banner image file
    if (req.file) {
      if (terms.bannerImage?.publicId) {
        try {
          await deleteFile(terms.bannerImage.publicId, "image");
        } catch (delErr: any) {
          console.warn("[Terms] Failed to delete old Cloudinary banner:", delErr?.message);
        }
      }

      terms.bannerImage = {
        url: (req.file as any).path || (req.file as any).secure_url,
        publicId: (req.file as any).filename || (req.file as any).public_id || "",
        caption: bodyData.bannerCaption || bodyData.caption || terms.bannerImage?.caption || "",
      };
    } else if (bodyData.imageUrl || bodyData.bannerImageUrl) {
      const rawUrl = bodyData.imageUrl || bodyData.bannerImageUrl;
      if (rawUrl.startsWith("data:") || rawUrl.startsWith("http")) {
        try {
          const uploaded = await uploadFile(rawUrl, "terms", "image");
          if (terms.bannerImage?.publicId) {
            try {
              await deleteFile(terms.bannerImage.publicId, "image");
            } catch {}
          }
          terms.bannerImage = {
            url: uploaded.secure_url,
            publicId: uploaded.public_id,
            caption: bodyData.bannerCaption || bodyData.caption || "",
          };
        } catch (uploadErr: any) {
          console.warn("[Terms] Cloudinary banner upload error:", uploadErr?.message);
        }
      }
    } else if (bodyData.bannerImage !== undefined) {
      terms.bannerImage = safeJsonParse(bodyData.bannerImage, terms.bannerImage);
    }

    // Update primitive fields
    if (bodyData.title !== undefined) terms.title = bodyData.title;
    if (bodyData.slug !== undefined) terms.slug = bodyData.slug;
    if (bodyData.version !== undefined) terms.version = bodyData.version;
    if (bodyData.summary !== undefined) terms.summary = bodyData.summary;
    if (bodyData.content !== undefined) terms.content = bodyData.content;
    if (bodyData.status !== undefined) terms.status = bodyData.status;
    if (bodyData.effectiveDate !== undefined) terms.effectiveDate = new Date(bodyData.effectiveDate);
    if (bodyData.governingLaw !== undefined) terms.governingLaw = bodyData.governingLaw;
    if (bodyData.contactEmail !== undefined) terms.contactEmail = bodyData.contactEmail;
    if (bodyData.changelog !== undefined) terms.changelog = bodyData.changelog;

    // Update complex fields
    if (bodyData.sections !== undefined) {
      terms.sections = safeJsonParse(bodyData.sections, terms.sections);
    }
    if (bodyData.keyHighlights !== undefined) {
      terms.keyHighlights = safeJsonParse(bodyData.keyHighlights, terms.keyHighlights);
    }
    if (bodyData.prohibitedActivities !== undefined) {
      terms.prohibitedActivities = safeJsonParse(bodyData.prohibitedActivities, terms.prohibitedActivities);
    }

    // Handle isCurrent toggle
    const isCurrentRequested =
      bodyData.isCurrent === true ||
      bodyData.isCurrent === "true" ||
      bodyData.isCurrent === 1;

    if (bodyData.isCurrent !== undefined) {
      if (isCurrentRequested && !terms.isCurrent) {
        await TermsAndConditionModel.updateMany({ _id: { $ne: terms._id }, isCurrent: true }, { isCurrent: false });
        terms.isCurrent = true;
        terms.status = "published";
      } else if (!isCurrentRequested && terms.isCurrent) {
        terms.isCurrent = false;
      }
    }

    terms.lastUpdated = new Date();
    terms.updatedBy = userId;

    await terms.save();

    try {
      await redisClient.del(TERMS_CACHE_KEY);
    } catch (cacheErr) {
      console.warn("[Terms] Cache invalidation warning:", cacheErr);
    }

    await AuditLogModel.create({
      action: "Terms and Conditions Updated",
      operator,
      details: `Updated Terms & Conditions v${terms.version} ("${terms.title}")`,
      level: "info",
    });

    emitAdminEntityUpdate({
      entityType: "config",
      action: "updated",
      data: terms,
    });

    return successHandler(res, 200, true, "Terms and conditions updated successfully", {
      terms,
    });
  }
);

/**
 * Set a specific revision as active live terms (Admin)
 */
export const setAsCurrentTermsAndCondition = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const operator = (req.user as any)?.username || "Admin";

    const terms = await TermsAndConditionModel.findById(id);
    if (!terms) {
      return errorHandler(res, 404, false, "Terms document not found", {});
    }

    await TermsAndConditionModel.updateMany({ _id: { $ne: terms._id }, isCurrent: true }, { isCurrent: false });

    terms.isCurrent = true;
    terms.status = "published";
    terms.lastUpdated = new Date();
    terms.updatedBy = (req.user as any)?.id;
    await terms.save();

    try {
      await redisClient.del(TERMS_CACHE_KEY);
    } catch (cacheErr) {
      console.warn("[Terms] Cache invalidation warning:", cacheErr);
    }

    await AuditLogModel.create({
      action: "Terms and Conditions Activated",
      operator,
      details: `Set Terms & Conditions v${terms.version} as the active current policy`,
      level: "info",
    });

    emitAdminEntityUpdate({
      entityType: "config",
      action: "updated",
      data: terms,
    });

    return successHandler(res, 200, true, "Terms revision activated as current policy", {
      terms,
    });
  }
);

/**
 * Delete a Terms revision (Admin)
 */
export const deleteTermsAndCondition = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const operator = (req.user as any)?.username || "Admin";

    const terms = await TermsAndConditionModel.findById(id);
    if (!terms) {
      return errorHandler(res, 404, false, "Terms document not found", {});
    }

    const totalCount = await TermsAndConditionModel.countDocuments();
    if (totalCount <= 1) {
      return errorHandler(
        res,
        400,
        false,
        "Cannot delete the only remaining terms and conditions document. Edit or replace it instead.",
        {}
      );
    }

    if (terms.isCurrent) {
      const nextTerms = await TermsAndConditionModel.findOne({
        _id: { $ne: terms._id },
        status: "published",
      }).sort({ createdAt: -1 });

      if (nextTerms) {
        nextTerms.isCurrent = true;
        await nextTerms.save();
      }
    }

    if (terms.bannerImage?.publicId) {
      try {
        await deleteFile(terms.bannerImage.publicId, "image");
      } catch (delErr: any) {
        console.warn("[Terms] Cloudinary banner deletion warning:", delErr?.message);
      }
    }

    await TermsAndConditionModel.findByIdAndDelete(id);

    try {
      await redisClient.del(TERMS_CACHE_KEY);
    } catch (cacheErr) {
      console.warn("[Terms] Cache invalidation warning:", cacheErr);
    }

    await AuditLogModel.create({
      action: "Terms and Conditions Deleted",
      operator,
      details: `Deleted Terms & Conditions v${terms.version} ("${terms.title}")`,
      level: "warning",
    });

    emitAdminEntityUpdate({
      entityType: "config",
      action: "deleted",
      data: { id, version: terms.version },
    });

    return successHandler(res, 200, true, "Terms revision deleted successfully", {
      deletedId: id,
    });
  }
);

/**
 * Standalone image upload for Terms (Admin)
 */
export const uploadTermsImage = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    let url = "";
    let publicId = "";

    if (req.file) {
      url = (req.file as any).path || (req.file as any).secure_url;
      publicId = (req.file as any).filename || (req.file as any).public_id || "";
    } else if (req.body.imageUrl) {
      const uploadRes = await uploadFile(req.body.imageUrl, "terms", "image");
      url = uploadRes.secure_url;
      publicId = uploadRes.public_id;
    } else {
      return errorHandler(res, 400, false, "No image file or image URL provided", {});
    }

    return successHandler(res, 200, true, "Image uploaded successfully for terms and conditions", {
      url,
      publicId,
      caption: req.body.caption || "",
    });
  }
);

/**
 * Seed or reset the default GoChat AI Terms and Conditions (Admin)
 */
export const seedDefaultTermsAndCondition = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const operator = (req.user as any)?.username || "Admin";

    await TermsAndConditionModel.updateMany({ isCurrent: true }, { isCurrent: false });

    const seeded = await TermsAndConditionModel.create({
      ...defaultTermsAndCondition,
      createdBy: (req.user as any)?.id,
      updatedBy: (req.user as any)?.id,
      lastUpdated: new Date(),
    });

    try {
      await redisClient.del(TERMS_CACHE_KEY);
    } catch (cacheErr) {
      console.warn("[Terms] Cache invalidation warning:", cacheErr);
    }

    await AuditLogModel.create({
      action: "Terms and Conditions Seeded",
      operator,
      details: `Seeded default GoChat AI Terms & Conditions v${seeded.version}`,
      level: "info",
    });

    emitAdminEntityUpdate({
      entityType: "config",
      action: "created",
      data: seeded,
    });

    return successHandler(res, 201, true, "Default terms and conditions seeded successfully", {
      terms: seeded,
    });
  }
);
