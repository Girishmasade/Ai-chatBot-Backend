import { Router } from "express";
import { authMiddleware, isAdmin } from "@/middlewares/auth.middleware.js";
import { upload } from "@/middlewares/multer.middleware.js";
import { validate } from "@/middlewares/zod.middleware.js";
import {
  executeAIRequestSchema,
  estimateCostSchema,
  getAIRequestByIdSchema,
  listMyRequestsSchema,
  cancelAIRequestSchema,
  adminListRequestsSchema,
  updateAIRequestSchema,
} from "./aiRequest.validation.js";
import {
  executeAIRequest,
  estimateCost,
  getMyAIRequests,
  getAIRequestById,
  cancelAIRequest,
  getAllAIRequests,
  adminGetAIRequestById,
  updateAIRequest,
  deleteAIRequest,
  adminGetUsageStats,
  generateImageHandler,
} from "./aiRequest.controller.js";

export const aiRequestRouter = Router();

// ─── User routes (auth required) ─────────────────────────────────────────────

aiRequestRouter.post(
  "/generate-image",
  authMiddleware,
  upload.single("image"),
  generateImageHandler
);

/**
 * @route   POST /api/v1/ai/execute
 * @desc    Execute any AI request — service type is in the body (CHAT, IMAGE, etc.)
 *          Provider is always resolved server-side from ServiceConfig.
 * @access  Authenticated user with active subscription
 */
aiRequestRouter.post(
  "/execute",
  authMiddleware,
  validate(executeAIRequestSchema),
  executeAIRequest
);

/**
 * @route   POST /api/v1/ai/estimate
 * @desc    Estimate token cost before executing a request (pre-flight check)
 * @access  Authenticated user
 */
aiRequestRouter.post(
  "/estimate",
  authMiddleware,
  validate(estimateCostSchema),
  estimateCost
);

/**
 * @route   GET /api/v1/ai/my-requests
 * @desc    Get the authenticated user's AI request history with pagination
 * @access  Authenticated user
 */
aiRequestRouter.get(
  "/my-requests",
  authMiddleware,
  validate(listMyRequestsSchema),
  getMyAIRequests
);

/**
 * @route   GET /api/v1/ai/get/:requestId
 * @desc    Get a single AI request (ownership enforced — users see only their own)
 * @access  Authenticated user
 */
aiRequestRouter.get(
  "/get/:requestId",
  authMiddleware,
  validate(getAIRequestByIdSchema),
  getAIRequestById
);

/**
 * @route   PATCH /api/v1/ai/cancel/:requestId
 * @desc    Cancel a PENDING request (only PENDING requests can be cancelled)
 * @access  Authenticated user
 */
aiRequestRouter.patch(
  "/cancel/:requestId",
  authMiddleware,
  validate(cancelAIRequestSchema),
  cancelAIRequest
);

// ─── Admin routes ─────────────────────────────────────────────────────────────

/**
 * @route   GET /api/v1/ai/admin/all
 * @desc    List all AI requests across all users with full filter support
 * @access  Admin
 */
aiRequestRouter.get(
  "/admin/all",
  authMiddleware,
  isAdmin,
  validate(adminListRequestsSchema),
  getAllAIRequests
);

/**
 * @route   GET /api/v1/ai/admin/stats
 * @desc    Aggregated usage stats — by service, provider, status, date range
 * @access  Admin
 */
aiRequestRouter.get(
  "/admin/stats",
  authMiddleware,
  isAdmin,
  adminGetUsageStats
);

/**
 * @route   GET /api/v1/ai/admin/get/:requestId
 * @desc    Get full detail of any request (user + transaction populated)
 * @access  Admin
 */
aiRequestRouter.get(
  "/admin/get/:requestId",
  authMiddleware,
  isAdmin,
  validate(getAIRequestByIdSchema),
  adminGetAIRequestById
);

/**
 * @route   PUT /api/v1/ai/admin/update/:requestId
 * @desc    Admin manual update of a request record (status correction, metadata patch)
 * @access  Admin
 */
aiRequestRouter.put(
  "/admin/update/:requestId",
  authMiddleware,
  isAdmin,
  validate(updateAIRequestSchema),
  updateAIRequest
);

/**
 * @route   DELETE /api/v1/ai/admin/delete/:requestId
 * @desc    Hard delete a request record
 * @access  Admin
 */
aiRequestRouter.delete(
  "/admin/delete/:requestId",
  authMiddleware,
  isAdmin,
  validate(getAIRequestByIdSchema),
  deleteAIRequest
);