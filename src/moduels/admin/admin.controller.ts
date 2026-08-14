import type { Request, Response, NextFunction } from "express";
import { AsyncHandler } from "@/utils/AsyncHandler.js";
import { successHandler } from "@/utils/successHandler.util.js";
import { errorHandler } from "@/utils/errorHandler.util.js";
import { AuthModel } from "../auth/auth.models.js";
import { UserSubscriptionModel } from "../subscription/userSubscription.model.js";
import { UserSubscriptionStatus } from "../../shared/shared.types.enum.js";
import TokenWalletModel from "../token/tokenWallet/tokenWallet.model.js";
import { SystemModelModel } from "./systemModel.model.js";
import { AuditLogModel } from "./auditLog.model.js";
import { BrandingModel } from "./branding.model.js";
import { CookieConsentModel } from "./cookieConsent.model.js";
import { AIAssetModel } from "./asset.model.js";
import {
  emitAdminEntityUpdate,
  emitAdminLog,
} from "@/socket/socket.emitter.js";
import type { AuthUser } from "../auth/auth.payload.js";
import redisClient from "@/config/redis.config.js";
import { uploadFile } from "@/utils/cloudinary.util.js";

// admin dashboard stats
export const adminDashboard = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const totalUsers = await AuthModel.countDocuments();
    const activeSubscriptions = await UserSubscriptionModel.countDocuments({
      status: UserSubscriptionStatus.ACTIVE,
    });
    const activeModels = await SystemModelModel.countDocuments({
      status: "active",
    });
    const totalModels = await SystemModelModel.countDocuments();

    // Compute Revenue (Est.) by summing price of active subscriptions
    const revAgg = await UserSubscriptionModel.aggregate([
      { $match: { status: UserSubscriptionStatus.ACTIVE } },
      { $group: { _id: null, totalRevenue: { $sum: "$price" } } },
    ]);
    const revenue = revAgg.length > 0 ? revAgg[0].totalRevenue : 0;

    // Compute User Tiers (assuming subscription planName or fetching all active)
    const paidUsersCount = await UserSubscriptionModel.distinct("user", {
      status: UserSubscriptionStatus.ACTIVE,
      planName: { $ne: "Enterprise" },
    });
    const enterpriseUsersCount = await UserSubscriptionModel.distinct("user", {
      status: UserSubscriptionStatus.ACTIVE,
      planName: "Enterprise",
    });
    const paidUsers = paidUsersCount.length;
    const enterpriseUsers = enterpriseUsersCount.length;
    const freeUsers = Math.max(0, totalUsers - paidUsers - enterpriseUsers);

    // Compute AI Service Usage
    const assetsAgg = await AIAssetModel.aggregate([
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]);

    let chatUsage = 0,
      imageUsage = 0,
      videoUsage = 0,
      assetUsage = 0;
    assetsAgg.forEach((agg) => {
      if (agg._id === "text") chatUsage = agg.count;
      if (agg._id === "image") imageUsage = agg.count;
      if (agg._id === "video") videoUsage = agg.count;
    });
    assetUsage = chatUsage + imageUsage + videoUsage;

    // Mocked System Health
    const systemHealth = [
      { service: "API Gateway", status: "Operational" },
      { service: "Database", status: "Operational" },
      { service: "AI Service", status: "Operational" },
    ];

    successHandler(res, 200, true, "Dashboard stats fetched", {
      totalUsers,
      activePlans: activeSubscriptions,
      activeModels,
      totalModels,
      revenue,
      subscriptionOverview: {
        freeUsers,
        paidUsers,
        enterpriseUsers,
      },
      serviceUsage: {
        chatUsage,
        imageUsage,
        videoUsage,
        assetUsage,
      },
      systemHealth,
    });
  },
);

// get admin profile
export const getAdminProfile = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as AuthUser;
    successHandler(res, 200, true, "Admin profile fetched", { data: user });
  },
);

// update admin profile
export const updateAdminProfile = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as AuthUser;
    successHandler(res, 200, true, "Admin profile updated", { data: user });
  },
);

// get users (dynamically aggregated with subscription & wallet credits)
export const getUsers = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const users = await AuthModel.find().lean();
    const userIds = users.map((u) => u._id);

    const [wallets, subscriptions] = await Promise.all([
      TokenWalletModel.find({ userId: { $in: userIds } }).lean(),
      UserSubscriptionModel.find({
        user: { $in: userIds },
        status: UserSubscriptionStatus.ACTIVE,
      }).lean(),
    ]);

    const walletMap = new Map(
      wallets.map((w: any) => [w.userId?.toString() || "", w.balance]),
    );
    const subMap = new Map(
      subscriptions.map((s: any) => [
        s.user?.toString() || "",
        s.planName || "free",
      ]),
    );

    const mappedUsers = users.map((u) => ({
      id: u._id.toString(),
      name: u.username,
      email: u.email,
      role: u.role,
      tier: subMap.get(u._id.toString()) || "free",
      credits: walletMap.get(u._id.toString()) ?? 100,
      joined: u.createdAt
        ? new Date(u.createdAt).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      status:
        (u as any).status || ((u as any).isBlocked ? "blocked" : "active"),
    }));

    successHandler(res, 200, true, "Users fetched dynamically", {
      data: mappedUsers,
    });
  },
);

// create user
export const createUser = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = await AuthModel.create(req.body);

    await AuditLogModel.create({
      action: "User Deployed",
      operator: (req.user as AuthUser)?.username || "Admin",
      details: `Created user ${user.email} with role ${user.role}`,
      level: "info",
    });

    emitAdminEntityUpdate({
      entityType: "user",
      action: "created",
      data: user,
    });

    successHandler(res, 201, true, "User created", { data: user });
  },
);

// update user
export const updateUser = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = await AuthModel.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (user) {
      try {
        await redisClient.del(`cache:user:${req.params.id}`);
      } catch (e) {
        console.error("Redis del error:", e);
      }
      await AuditLogModel.create({
        action: "User Updated",
        operator: (req.user as AuthUser)?.username || "Admin",
        details: `Updated user record for ${user.email}`,
        level: "info",
      });
      emitAdminEntityUpdate({
        entityType: "user",
        action: "updated",
        data: user,
      });
    }

    successHandler(res, 200, true, "User updated", { data: user });
  },
);

// delete user (soft delete / status disabled)
export const deleteUser = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = await AuthModel.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "disabled", isBlocked: true } },
      { new: true },
    );

    if (user) {
      try {
        await redisClient.del(`cache:user:${req.params.id}`);
      } catch (e) {
        console.error("Redis del error:", e);
      }
      await AuditLogModel.create({
        action: "User Account Disabled",
        operator: (req.user as AuthUser)?.username || "Admin",
        details: `Disabled user account ${user.email}`,
        level: "warning",
      });
      emitAdminEntityUpdate({
        entityType: "user",
        action: "updated",
        data: user,
      });
    }

    successHandler(res, 200, true, "User status disabled successfully", {
      data: user,
    });
  },
);

// get models
export const getModels = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const CACHE_KEY = "cache:admin:models";
    try {
      const cached = await redisClient.get(CACHE_KEY);
      if (cached) {
        return successHandler(
          res,
          200,
          true,
          "Models fetched (from Redis cache)",
          { data: JSON.parse(cached) },
        );
      }
    } catch (err) {
      console.error("Redis read error:", err);
    }

    const models = await SystemModelModel.find().lean();

    const mappedModels = models.map((m) => ({
      id: m._id.toString(),
      name: m.name,
      version: m.version,
      type: m.type,
      status: m.status,
      latency: m.latency,
      description: m.description,
      provider: m.provider,
      cost: m.cost,
      tier: m.tier,
    }));

    try {
      await redisClient.setEx(CACHE_KEY, 3600, JSON.stringify(mappedModels));
    } catch (err) {
      console.error("Redis write error:", err);
    }

    successHandler(res, 200, true, "Models fetched", { data: mappedModels });
  },
);

// toggle model status
export const toggleModel = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const model = await SystemModelModel.findById(req.params.id);

    if (!model) {
      return errorHandler(res, 404, false, "Model not found", {});
    }

    model.status = model.status === "active" ? "inactive" : "active";
    await model.save();

    try {
      await redisClient.del("cache:admin:models");
    } catch (err) {
      console.error("Redis clear error:", err);
    }

    await AuditLogModel.create({
      action: "Model Toggled",
      operator: (req.user as AuthUser)?.username || "Admin",
      details: `Toggled state of ${model.name} to ${model.status}`,
      level: "warning",
    });

    emitAdminEntityUpdate({
      entityType: "model",
      action: "updated",
      data: model,
    });

    successHandler(res, 200, true, "Model toggled", { data: model });
  },
);

// create model
export const createModel = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const model = await SystemModelModel.create(req.body);

    try {
      await redisClient.del("cache:admin:models");
    } catch (err) {
      console.error("Redis clear error:", err);
    }

    await AuditLogModel.create({
      action: "Model Created",
      operator: (req.user as AuthUser)?.username || "Admin",
      details: `Created new AI model configuration: ${model.name}`,
      level: "info",
    });

    emitAdminEntityUpdate({
      entityType: "model",
      action: "created",
      data: model,
    });

    successHandler(res, 201, true, "Model created", { data: model });
  },
);

// delete model
export const deleteModel = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const model = await SystemModelModel.findByIdAndDelete(req.params.id);

    if (!model) {
      return errorHandler(res, 404, false, "Model not found", {});
    }

    try {
      await redisClient.del("cache:admin:models");
    } catch (err) {
      console.error("Redis clear error:", err);
    }

    await AuditLogModel.create({
      action: "Model Deleted",
      operator: (req.user as AuthUser)?.username || "Admin",
      details: `Deleted AI model configuration: ${model.name}`,
      level: "warning",
    });

    emitAdminEntityUpdate({
      entityType: "model",
      action: "deleted",
      data: model,
    });

    successHandler(res, 200, true, "Model deleted", { data: model });
  },
);

// get subscriptions
export const getSubscriptions = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const subs = await UserSubscriptionModel.find().populate("user").lean();

    const mappedSubs = subs.map((s: any) => ({
      id: s._id.toString(),
      userId: s.user?._id?.toString() || s.user || "N/A",
      userEmail: s.user?.email || "user@gochat.ai",
      plan: s.planName || "Free",
      price: `₹${s.price || 0}`,
      cycle: s.durationInDays ? `${s.durationInDays}d` : "Monthly",
      date: s.createdAt
        ? new Date(s.createdAt).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      status: s.status === "active" ? "paid" : "failed",
    }));

    successHandler(res, 200, true, "Subscriptions fetched", {
      data: mappedSubs,
    });
  },
);

// get audit logs
export const getLogs = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const logs = await AuditLogModel.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const mappedLogs = logs.map((l) => ({
      id: l._id.toString(),
      action: l.action,
      operator: l.operator,
      timestamp: l.createdAt
        ? new Date(l.createdAt).toLocaleString()
        : new Date().toLocaleString(),
      details: l.details,
      level: l.level,
    }));

    successHandler(res, 200, true, "Audit logs fetched from database", {
      data: mappedLogs,
    });
  },
);

// get branding & cookie consents config
export const getConfig = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const CACHE_KEY = "cache:admin:config";
    try {
      const cached = await redisClient.get(CACHE_KEY);
      if (cached) {
        return successHandler(
          res,
          200,
          true,
          "Config fetched (from Redis cache)",
          { data: JSON.parse(cached) },
        );
      }
    } catch (err) {
      console.error("Redis read error:", err);
    }

    let branding = await BrandingModel.findOne().lean();

    if (!branding) {
      const createdBranding = await BrandingModel.create({});
      branding = createdBranding.toObject();
    }

    const cookieConsents = await CookieConsentModel.find().lean();

    const mappedConsents = cookieConsents.map((c) => ({
      id: c._id.toString(),
      user: c.user,
      consented: c.consented,
      categories: c.categories,
      timestamp: (c as any).createdAt
        ? new Date((c as any).createdAt).toLocaleString()
        : new Date().toLocaleString(),
    }));

    const responseData = {
      branding: {
        appName: branding.appName,
        logoName: branding.logoName,
        logoImage: branding.logoImage,
        mainLogo: branding.mainLogo,
        favicon: branding.favicon,
        mobileLogo: branding.mobileLogo,
        themeMode: branding.themeMode,
        primaryColor: branding.primaryColor,
        accentGlow: branding.accentGlow,
        footerText: branding.footerText,
        phone: branding.phone,
        email: branding.email,
        description: branding.description,
        twitterUrl: branding.twitterUrl,
        linkedinUrl: branding.linkedinUrl,
        seoTitle: branding.seoTitle,
        seoDescription: branding.seoDescription,
        seoKeywords: branding.seoKeywords,
      },
      cookieConsents: mappedConsents,
    };

    try {
      await redisClient.setEx(CACHE_KEY, 3600, JSON.stringify(responseData));
    } catch (err) {
      console.error("Redis write error:", err);
    }

    successHandler(res, 200, true, "Config fetched from database", {
      data: responseData,
    });
  },
);

// update branding config
export const updateBranding = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    let branding = await BrandingModel.findOne();

    const updateData = { ...req.body };
    const files = req.files as
      | { [fieldname: string]: Express.Multer.File[] }
      | undefined;

    if (files) {
      if (files.mainLogo && files.mainLogo[0]) {
        const file = files.mainLogo[0];
        updateData.mainLogo = (file as any).path || (file as any).secure_url;
      }
      if (files.favicon && files.favicon[0]) {
        const file = files.favicon[0];
        updateData.favicon = (file as any).path || (file as any).secure_url;
      }
      if (files.mobileLogo && files.mobileLogo[0]) {
        const file = files.mobileLogo[0];
        updateData.mobileLogo = (file as any).path || (file as any).secure_url;
      }
    }

    if (!branding) {
      branding = await BrandingModel.create(updateData);
    } else {
      Object.assign(branding, updateData);
      await branding.save();
    }

    try {
      await redisClient.del("cache:admin:config");
    } catch (err) {
      console.error("Redis clear error:", err);
    }

    await AuditLogModel.create({
      action: "Branding Updated",
      operator: (req.user as AuthUser)?.username || "Admin",
      details: `Updated platform branding config: ${branding.logoName}`,
      level: "info",
    });

    emitAdminEntityUpdate({
      entityType: "config",
      action: "updated",
      data: branding,
    });

    successHandler(res, 200, true, "Branding updated in database", {
      data: branding,
    });
  },
);

// log cookie consent
export const logCookieConsent = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { user, categories } = req.body;

    const consent = await CookieConsentModel.create({
      user: user || "Anonymous User",
      consented: true,
      categories: categories || ["Essential"],
    });

    successHandler(res, 201, true, "Cookie consent recorded", {
      data: consent,
    });
  },
);

// assets management (get user assets / save generated asset / delete asset)
export const getUserAssets = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req.user as AuthUser)?.id;
    const assets = await AIAssetModel.find({ user: userId })
      .sort({ createdAt: -1 })
      .lean();

    const mappedAssets = assets.map((a) => ({
      id: a._id.toString(),
      type: a.type,
      title: a.title,
      prompt: a.prompt,
      content: a.content,
      model: a.model,
      timestamp: (a as any).createdAt
        ? new Date((a as any).createdAt).toLocaleString()
        : new Date().toLocaleString(),
    }));

    successHandler(res, 200, true, "Assets fetched", { data: mappedAssets });
  },
);

export const deleteAsset = AsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = (req.user as AuthUser)?.id;

    await AIAssetModel.findOneAndDelete({ _id: id, user: userId });

    successHandler(res, 200, true, "Asset deleted", {});
  },
);
