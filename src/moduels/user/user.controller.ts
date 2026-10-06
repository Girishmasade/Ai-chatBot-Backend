import type { Request, Response, NextFunction } from "express";
import { AuthModel } from "../auth/auth.models.js";
import { errorHandler } from "@/utils/errorHandler.util.js";
import { successHandler } from "@/utils/successHandler.util.js";
import type { AuthUser } from "../auth/auth.payload.js";
import {
  deleteFile,
  extractPublicId,
  uploadFile,
} from "@/utils/cloudinary.util.js";
import { UserSubscriptionModel } from "../subscription/userSubscription.model.js";
import { UserSubscriptionStatus } from "@/shared/shared.types.enum.js";

// get user Profile

export const getUserProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = (req.user as AuthUser).id;

    if (!userId) {
      return errorHandler(res, 404, false, "userId is required", {});
    }

    const user = await AuthModel.findById({ _id: userId });

    // console.log("user Details :", user)

    if (!user) {
      return errorHandler(res, 404, false, "user Not Found", {});
    }

    const activeSub = await UserSubscriptionModel.findOne({
      user: userId,
      status: UserSubscriptionStatus.ACTIVE,
    })
      .populate("plan")
      .sort({ createdAt: -1 });

    const plan = activeSub?.plan as any;
    const isPaid = Boolean(
      plan &&
        ((plan.price && plan.price > 0) ||
          (plan.plan && plan.plan !== "FREE" && plan.price > 0)),
    );

    return successHandler(res, 200, true, "Here are you're Details", {
      user,
      subscription: activeSub || null,
      plan: plan || null,
      isPaid,
      tier: isPaid ? "paid" : "free",
    });
  } catch (error) {
    console.error("error in get user profile :", error);
    next(error);
  }
};

// update user profile

export const updateUserProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      return next(new Error("Unauthorized"));
    }

    const userId = (req.user as AuthUser).id;
    const { ...data } = req.body;

    if (!userId) {
      return errorHandler(res, 404, false, "User Id is required", {});
    }

    const updateData = await AuthModel.findByIdAndUpdate(
      { _id: userId },
      data,
    ).select("avatar");

    console.log("userData :", updateData);

    if (!updateData) {
      return errorHandler(res, 404, false, "User Not Found", {});
    }

    return successHandler(res, 201, true, "Profile Updated Succesfully", {
      data,
    });
  } catch (error) {
    console.error("error to update profile :", error);
    next(error);
  }
};

// update user avatar

export const updateUserAvatar = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = (req.user as AuthUser).id;
    const filePath = req.file?.path;

    if (!userId) {
      return errorHandler(res, 404, false, "User Id is required", {});
    }

    if (!filePath) {
      return errorHandler(res, 400, false, "Avatar file is required", {});
    }

    const existingUser = await AuthModel.findById(userId);

    console.log("existing User : ", existingUser)

    if (!existingUser) {
      return errorHandler(res, 404, false, "User not found", {});
    }

    const uploadedAvatar = await uploadFile(filePath, "Avatar");

    console.log("uploaded Avatar :", uploadedAvatar)

    if (existingUser.avatar) {
      const oldPublicId = extractPublicId(existingUser.avatar); 
      await deleteFile(oldPublicId, "image");
    }

    const updatedUser = await AuthModel.findByIdAndUpdate(
      userId,
      { avatar: uploadedAvatar.secure_url },
      { new: true },
    );

    console.log("updated User :", updatedUser)

    return successHandler(res, 201, true, "Avatar Added successfully", {
      avatar: updatedUser?.avatar,
    });
  } catch (error) {
    console.log("error to update the avatar", error);
    next(error);
  }
};

// delete user profile

export const deleteUserProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = (req.user as AuthUser).id;

    if (!userId) {
    return errorHandler(res, 404, false, "User id is required", {});
    }

    const userDelete  = await AuthModel.findByIdAndDelete({_id: userId})
    
    if (!userDelete) {
      return errorHandler(res, 404, false, "User Not Found", {});
    }

    if (userDelete.avatar) {
      const publicId = extractPublicId(userDelete.avatar);
      await deleteFile(publicId, "image");
    }

    return successHandler(res, 200, true, "Profile Deleted Successfully", {});
    
  } catch (error) {
    console.log("error to delete the user profile :", error);
    next(error);
  }
};
