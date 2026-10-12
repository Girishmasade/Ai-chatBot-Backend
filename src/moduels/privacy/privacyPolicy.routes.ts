import { Router } from "express";
import { authMiddleware, optionalAuth, isAdmin } from "@/middlewares/auth.middleware.js";
import { upload } from "@/middlewares/multer.middleware.js";
import {
  getCurrentPrivacyPolicy,
  getPrivacyPolicyBySlugOrVersion,
  getPrivacyPolicyHistory,
  getAllPrivacyPolicies,
  getPrivacyPolicyById,
  createPrivacyPolicy,
  updatePrivacyPolicy,
  setAsCurrentPrivacyPolicy,
  deletePrivacyPolicy,
  uploadPolicyImage,
  seedDefaultPrivacyPolicy,
} from "./privacyPolicy.controller.js";

export const privacyPolicyRouter = Router();

// ── Public / User Endpoints ──────────────────────────────────────────────────
// Any user or visitor can read the current privacy policy and revision history
privacyPolicyRouter.get("/", optionalAuth, getCurrentPrivacyPolicy);
privacyPolicyRouter.get("/current", optionalAuth, getCurrentPrivacyPolicy);
privacyPolicyRouter.get("/history", optionalAuth, getPrivacyPolicyHistory);
privacyPolicyRouter.get("/revision/:slugOrVersion", optionalAuth, getPrivacyPolicyBySlugOrVersion);

// ── Protected Admin Endpoints ────────────────────────────────────────────────
// Manage privacy policy versions, upload banner images, toggle active status
privacyPolicyRouter.get(
  "/admin/all",
  authMiddleware,
  isAdmin,
  getAllPrivacyPolicies
);

privacyPolicyRouter.get(
  "/admin/:id",
  authMiddleware,
  isAdmin,
  getPrivacyPolicyById
);

privacyPolicyRouter.post(
  "/admin",
  authMiddleware,
  isAdmin,
  upload.single("bannerImage"),
  createPrivacyPolicy
);

privacyPolicyRouter.put(
  "/admin/:id",
  authMiddleware,
  isAdmin,
  upload.single("bannerImage"),
  updatePrivacyPolicy
);

privacyPolicyRouter.patch(
  "/admin/:id/set-current",
  authMiddleware,
  isAdmin,
  setAsCurrentPrivacyPolicy
);

privacyPolicyRouter.delete(
  "/admin/:id",
  authMiddleware,
  isAdmin,
  deletePrivacyPolicy
);

privacyPolicyRouter.post(
  "/admin/upload-image",
  authMiddleware,
  isAdmin,
  upload.single("image"),
  uploadPolicyImage
);

privacyPolicyRouter.post(
  "/admin/seed",
  authMiddleware,
  isAdmin,
  seedDefaultPrivacyPolicy
);

export default privacyPolicyRouter;
