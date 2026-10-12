import { Router } from "express";
import { authMiddleware, optionalAuth, isAdmin } from "@/middlewares/auth.middleware.js";
import { upload } from "@/middlewares/multer.middleware.js";
import {
  getCurrentTermsAndCondition,
  getTermsAndConditionBySlugOrVersion,
  getTermsAndConditionHistory,
  getAllTermsAndConditions,
  getTermsAndConditionById,
  createTermsAndCondition,
  updateTermsAndCondition,
  setAsCurrentTermsAndCondition,
  deleteTermsAndCondition,
  uploadTermsImage,
  seedDefaultTermsAndCondition,
} from "./termsandcondition.controller.js";

export const termsRouter = Router();

// ── Public / User Endpoints ──────────────────────────────────────────────────
termsRouter.get("/", optionalAuth, getCurrentTermsAndCondition);
termsRouter.get("/current", optionalAuth, getCurrentTermsAndCondition);
termsRouter.get("/history", optionalAuth, getTermsAndConditionHistory);
termsRouter.get("/revision/:slugOrVersion", optionalAuth, getTermsAndConditionBySlugOrVersion);

// ── Protected Admin Endpoints ────────────────────────────────────────────────
termsRouter.get(
  "/admin/all",
  authMiddleware,
  isAdmin,
  getAllTermsAndConditions
);

termsRouter.get(
  "/admin/:id",
  authMiddleware,
  isAdmin,
  getTermsAndConditionById
);

termsRouter.post(
  "/admin",
  authMiddleware,
  isAdmin,
  upload.single("bannerImage"),
  createTermsAndCondition
);

termsRouter.put(
  "/admin/:id",
  authMiddleware,
  isAdmin,
  upload.single("bannerImage"),
  updateTermsAndCondition
);

termsRouter.patch(
  "/admin/:id/set-current",
  authMiddleware,
  isAdmin,
  setAsCurrentTermsAndCondition
);

termsRouter.delete(
  "/admin/:id",
  authMiddleware,
  isAdmin,
  deleteTermsAndCondition
);

termsRouter.post(
  "/admin/upload-image",
  authMiddleware,
  isAdmin,
  upload.single("image"),
  uploadTermsImage
);

termsRouter.post(
  "/admin/seed",
  authMiddleware,
  isAdmin,
  seedDefaultTermsAndCondition
);

export default termsRouter;
