import type { Request, Response, NextFunction } from "express";
import { AsyncHandler } from "@/utils/AsyncHandler.js";
import { successHandler } from "@/utils/successHandler.util.js";
import { errorHandler } from "@/utils/errorHandler.util.js";
import { ChatSessionModel } from "./chatHistory.model.js";
import type { AuthUser } from "../auth/auth.payload.js";

/**
 * GET /api/v1/chat/sessions
 * List all chat history sessions for the logged-in user
 */
export const getChatSessions = AsyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req.user as AuthUser).id;

  const sessions = await ChatSessionModel.find({ userId })
    .sort({ updatedAt: -1 })
    .select("_id title service lastModel messages updatedAt createdAt")
    .lean();

  const mapped = sessions.map((s) => {
    const lastMsg = s.messages && s.messages.length > 0 ? s.messages[s.messages.length - 1] : null;
    return {
      id: s._id.toString(),
      title: s.title,
      service: s.service,
      lastModel: s.lastModel || lastMsg?.model || "AI Model",
      messageCount: s.messages?.length || 0,
      lastSnippet: lastMsg?.content ? lastMsg.content.slice(0, 100) : "",
      updatedAt: s.updatedAt,
      createdAt: s.createdAt,
    };
  });

  return successHandler(res, 200, true, "Chat sessions fetched successfully", { sessions: mapped });
});

/**
 * GET /api/v1/chat/sessions/:sessionId
 * Fetch details and message thread for a specific chat session
 */
export const getChatSessionById = AsyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req.user as AuthUser).id;
  const { sessionId } = req.params;

  const session = await ChatSessionModel.findOne({ _id: sessionId, userId }).lean();
  if (!session) {
    return errorHandler(res, 404, false, "Chat session not found", {});
  }

  return successHandler(res, 200, true, "Chat session details fetched", { session });
});

/**
 * POST /api/v1/chat/sessions
 * Save or append messages to a chat session
 */
export const saveChatMessage = AsyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req.user as AuthUser).id;
  const { sessionId, title, service, userMessage, aiResponse, model, provider } = req.body;

  if (!userMessage || !aiResponse) {
    return errorHandler(res, 400, false, "userMessage and aiResponse are required", {});
  }

  let session;

  if (sessionId) {
    session = await ChatSessionModel.findOne({ _id: sessionId, userId });
  }

  const promptTitle = title || (userMessage.length > 40 ? userMessage.slice(0, 40) + "..." : userMessage);

  if (!session) {
    session = new ChatSessionModel({
      userId,
      title: promptTitle,
      service: service || "ai_chat",
      lastModel: model || "AI Model",
      messages: [],
    });
  }

  // Push user prompt message
  session.messages.push({
    role: "user",
    content: userMessage,
    timestamp: new Date(),
  });

  // Push AI response message
  session.messages.push({
    role: "assistant",
    content: aiResponse,
    model: model || "AI Model",
    provider: provider || "",
    timestamp: new Date(),
  });

  session.lastModel = model || session.lastModel;
  session.updatedAt = new Date();

  await session.save();

  return successHandler(res, 200, true, "Chat message saved to history", {
    session: {
      id: session._id.toString(),
      title: session.title,
      service: session.service,
      lastModel: session.lastModel,
      messages: session.messages,
      updatedAt: session.updatedAt,
    },
  });
});

/**
 * DELETE /api/v1/chat/sessions/:sessionId
 * Delete a specific chat session
 */
export const deleteChatSession = AsyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req.user as AuthUser).id;
  const { sessionId } = req.params;

  const deleted = await ChatSessionModel.findOneAndDelete({ _id: sessionId, userId });
  if (!deleted) {
    return errorHandler(res, 404, false, "Chat session not found", {});
  }

  return successHandler(res, 200, true, "Chat session deleted successfully", { id: sessionId });
});

/**
 * DELETE /api/v1/chat/sessions
 * Clear all chat history for the user
 */
export const clearAllChatSessions = AsyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req.user as AuthUser).id;

  await ChatSessionModel.deleteMany({ userId });

  return successHandler(res, 200, true, "All chat history cleared successfully", {});
});
