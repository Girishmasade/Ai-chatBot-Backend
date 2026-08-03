import { authMiddleware, isAdmin } from "@/middlewares/auth.middleware.js";
import { Router } from "express";
import { 
  adminDashboard, getAdminProfile, updateAdminProfile,
  getUsers, createUser, updateUser, deleteUser,
  getModels, toggleModel, createModel, deleteModel,
  getSubscriptions,
  getLogs,
  getConfig, updateBranding,
  logCookieConsent, getUserAssets, deleteAsset
} from "./admin.controller.js";
import { upload } from "@/middlewares/multer.middleware.js";

export const adminRouter = Router();

adminRouter.use(authMiddleware);

// User-facing endpoints for assets & consents
adminRouter.post("/cookie-consent", logCookieConsent);
adminRouter.get("/assets", getUserAssets);
adminRouter.delete("/assets/:id", deleteAsset);

// Admin-only protected routes
adminRouter.get("/dashboard", isAdmin, adminDashboard);
adminRouter.get("/profile", isAdmin, getAdminProfile);
adminRouter.put("/update-profile", isAdmin, upload.single("avatar"), updateAdminProfile);

// users management
adminRouter.get("/users", isAdmin, getUsers);
adminRouter.post("/users", isAdmin, createUser);
adminRouter.put("/users/:id", isAdmin, updateUser);
adminRouter.delete("/users/:id", isAdmin, deleteUser);

// ai models
adminRouter.get("/models", getModels);
adminRouter.post("/models", isAdmin, createModel);
adminRouter.put("/models/:id/toggle", isAdmin, toggleModel);
adminRouter.delete("/models/:id", isAdmin, deleteModel);

// subscriptions
adminRouter.get("/subscriptions", isAdmin, getSubscriptions);

// audit logs
adminRouter.get("/logs", isAdmin, getLogs);

// branding config
adminRouter.get("/config", getConfig);
adminRouter.put(
  "/config/branding",
  isAdmin,
  upload.fields([
    { name: "mainLogo", maxCount: 1 },
    { name: "favicon", maxCount: 1 },
    { name: "mobileLogo", maxCount: 1 },
  ]),
  updateBranding
);
