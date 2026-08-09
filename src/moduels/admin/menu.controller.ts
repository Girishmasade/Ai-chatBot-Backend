import type { Request, Response, NextFunction } from "express";
import { AsyncHandler } from "@/utils/AsyncHandler.js";
import { successHandler } from "@/utils/successHandler.util.js";
import { errorHandler } from "@/utils/errorHandler.util.js";
import { MenuItemModel } from "./menu.model.js";
import type { AuthUser } from "../auth/auth.payload.js";
import { emitAdminEntityUpdate } from "@/socket/socket.emitter.js";
import redisClient from "@/config/redis.config.js";

const CACHE_KEY_USER_MENU = "cache:menu:user";
const CACHE_KEY_ADMIN_MENU = "cache:menu:admin";
const CACHE_TTL_SECONDS = 3600; // 1 hour

const clearMenuCache = async () => {
  try {
    await redisClient.del([CACHE_KEY_USER_MENU, CACHE_KEY_ADMIN_MENU]);
  } catch (err) {
    console.error("Redis menu cache clear error:", err);
  }
};

export const getUserMenuItems = AsyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cached = await redisClient.get(CACHE_KEY_USER_MENU);
    if (cached) {
      return successHandler(res, 200, true, "User menu items fetched (from Redis cache)", {
        data: JSON.parse(cached),
      });
    }
  } catch (err) {
    console.error("Redis read error:", err);
  }

  const items = await MenuItemModel.find({ visible: { $in: ["User Menu", "All"] }, isActive: true }).sort({ order: 1 }).lean();

  const mapped = items.map((item) => ({
    id: item._id.toString(),
    label: item.label,
    icon: item.icon,
    target: item.target,
    visible: item.visible,
    order: item.order,
    isActive: item.isActive,
    parentId: item.parentId?.toString() || undefined,
  }));

  try {
    await redisClient.setEx(CACHE_KEY_USER_MENU, CACHE_TTL_SECONDS, JSON.stringify(mapped));
  } catch (err) {
    console.error("Redis write error:", err);
  }

  successHandler(res, 200, true, "User menu items fetched", { data: mapped });
});

export const getAdminMenuItems = AsyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cached = await redisClient.get(CACHE_KEY_ADMIN_MENU);
    if (cached) {
      return successHandler(res, 200, true, "Admin menu items fetched (from Redis cache)", {
        data: JSON.parse(cached),
      });
    }
  } catch (err) {
    console.error("Redis read error:", err);
  }

  const items = await MenuItemModel.find().sort({ order: 1 }).lean();

  const mapped = items.map((item) => ({
    id: item._id.toString(),
    label: item.label,
    icon: item.icon,
    target: item.target,
    visible: item.visible,
    order: item.order,
    isActive: item.isActive,
    parentId: item.parentId?.toString() || undefined,
  }));

  try {
    await redisClient.setEx(CACHE_KEY_ADMIN_MENU, CACHE_TTL_SECONDS, JSON.stringify(mapped));
  } catch (err) {
    console.error("Redis write error:", err);
  }

  successHandler(res, 200, true, "Admin menu items fetched", { data: mapped });
});

export const createMenuItem = AsyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const adminId = (req.user as AuthUser)?.id;
  const { label, icon, target, visible, order, parentId } = req.body;

  if (!label || !target) {
    return errorHandler(res, 400, false, "Label and target are required", {});
  }

  const newItem = await MenuItemModel.create({
    label,
    icon: icon || "LayoutDashboard",
    target,
    visible: visible || "User Menu",
    order: order || 0,
    isActive: true,
    parentId: parentId || null,
    createdBy: adminId,
  });

  await clearMenuCache();
  emitAdminEntityUpdate({ entityType: "menu", action: "created", data: newItem });

  successHandler(res, 201, true, "Menu item created successfully", { data: newItem });
});

export const getMenuItemById = AsyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const item = await MenuItemModel.findById(id).lean();

  if (!item) {
    return errorHandler(res, 404, false, "Menu item not found", {});
  }

  const mapped = {
    id: item._id.toString(),
    label: item.label,
    icon: item.icon,
    target: item.target,
    visible: item.visible,
    order: item.order,
    isActive: item.isActive,
    parentId: item.parentId?.toString() || undefined,
  };

  successHandler(res, 200, true, "Menu item fetched successfully", { data: mapped });
});

export const updateMenuItem = AsyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  const updatedItem = await MenuItemModel.findByIdAndUpdate(id, req.body, { new: true });
  if (!updatedItem) {
    return errorHandler(res, 404, false, "Menu item not found", {});
  }

  await clearMenuCache();
  emitAdminEntityUpdate({ entityType: "menu", action: "updated", data: updatedItem });

  successHandler(res, 200, true, "Menu item updated successfully", { data: updatedItem });
});

export const deleteMenuItem = AsyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  await MenuItemModel.findByIdAndDelete(id);

  await clearMenuCache();
  emitAdminEntityUpdate({ entityType: "menu", action: "deleted", data: { id } });

  successHandler(res, 200, true, "Menu item deleted successfully", {});
});
