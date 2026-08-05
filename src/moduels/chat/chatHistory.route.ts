import { Router } from "express";
import { authMiddleware } from "@/middlewares/auth.middleware.js";
import {
  getChatSessions,
  getChatSessionById,
  saveChatMessage,
  deleteChatSession,
  clearAllChatSessions,
} from "./chatHistory.controller.js";

export const chatHistoryRouter = Router();

chatHistoryRouter.get("/sessions", authMiddleware, getChatSessions);
chatHistoryRouter.get("/sessions/:sessionId", authMiddleware, getChatSessionById);
chatHistoryRouter.post("/sessions", authMiddleware, saveChatMessage);
chatHistoryRouter.delete("/sessions/:sessionId", authMiddleware, deleteChatSession);
chatHistoryRouter.delete("/sessions", authMiddleware, clearAllChatSessions);
