import { Router } from "express";
import { authMiddleware, isAdmin } from "@/middlewares/auth.middleware.js";
import {
  getUserMenuItems,
  getAdminMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getMenuItemById
} from "./menu.controller.js";

export const menuRouter = Router();

// Public / Authenticated User Sidebar Route
menuRouter.get("/user", authMiddleware, getUserMenuItems);

// Admin Management Routes
menuRouter.get("/admin", authMiddleware, isAdmin, getAdminMenuItems);
menuRouter.post("/create", authMiddleware, isAdmin, createMenuItem);
menuRouter.get("/:id", authMiddleware, isAdmin, getMenuItemById);
menuRouter.put("/:id", authMiddleware, isAdmin, updateMenuItem);
menuRouter.delete("/:id", authMiddleware, isAdmin, deleteMenuItem);
