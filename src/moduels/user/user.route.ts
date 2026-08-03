import { Router } from "express";
import { deleteUserProfile, getUserProfile, updateUserProfile } from "./user.controller.js";
import { authMiddleware } from "@/middlewares/auth.middleware.js";
import { upload } from "@/middlewares/multer.middleware.js";

export const userRouter = Router()

userRouter.get("/get-profile/:userId", authMiddleware, getUserProfile)
userRouter.put("/update-profile", authMiddleware, upload.single("avatar"), updateUserProfile)
userRouter.delete("/delete-profile", authMiddleware, deleteUserProfile)
