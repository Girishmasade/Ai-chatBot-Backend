import { AsyncHandler } from "@/utils/AsyncHandler.js";
import type { AuthUser } from "../auth/auth.payload.js";
import { errorHandler } from "@/utils/errorHandler.util.js";
import { SubscriptionPlanModel } from "./subscription.model.js";
import { successHandler } from "@/utils/successHandler.util.js";
import type { CreateSubInput } from "./subscription.types.js";
import { UserSubscriptionModel } from "./userSubscription.model.js";
import { UserSubscriptionStatus } from "@/shared/shared.types.enum.js";

// Admin create Subscription function

export const createSubscription = AsyncHandler(async (req, res, next) => {
  try {
    const AdminId = (req.user as AuthUser).id;

    if (!AdminId) {
      return errorHandler(res, 404, false, "Admin not found", {});
    }

    const {
      name,
      plan,
      price,
      currency,
      description,
      tokens,
      durationInDays,
      services,
      isActive,
    } = req.body as CreateSubInput & { tokens?: number; durationInDays?: number; currency?: string };

    if (!name || !plan || price === undefined || !description) {
      return errorHandler(res, 400, false, "Name, plan, price and description are required", {});
    }

    const existing = await SubscriptionPlanModel.findOne({ name });
    if (existing) {
      return errorHandler(
        res,
        409,
        false,
        "A subscription plan with this name already exists",
        {},
      );
    }

    const createSubscription = await SubscriptionPlanModel.create({
      name,
      plan,
      price,
      currency: currency || "INR",
      description,
      tokens: tokens ?? 500,
      durationInDays: durationInDays ?? 30,
      services: services && services.length > 0 ? services : ["CHAT"],
      isActive: isActive !== undefined ? isActive : true,
      createdBy: AdminId,
    });

    console.log("create Subscription :", createSubscription);

    if (!createSubscription) {
      return errorHandler(res, 400, false, "Subscription plan not created", {});
    }

    return successHandler(res, 200, true, "Subscription Created Successfully", {
      createSubscription,
    });
  } catch (error) {
    console.log("error to create Subscription :", error);
    next(error);
  }
});

// admin and user get subscription plans
export const getSubscriptionForUser = AsyncHandler(async (req, res, next) => {
  try {
    const userRole = (req.user as AuthUser)?.role;
    const isAdminUser = userRole === "admin" || userRole === "Administrator";
    
    // Admin sees all subscription plans created; Users see active subscription plans
    const queryFilter = isAdminUser ? {} : { isActive: true };

    const subscriptionPlan = await SubscriptionPlanModel.find(queryFilter).sort({ price: 1 });

    console.log("subscription Plan :", subscriptionPlan);

    if (!subscriptionPlan) {
      return errorHandler(res, 404, false, "Subscription Plan not Found", {});
    }

    return successHandler(
      res,
      200,
      true,
      "Subscription Plan Fetched Successfully",
      { subscriptionPlan },
    );
  } catch (error) {
    console.log("error to get Subscription :", error);
    next(error);
  }
});

// admin update Subscription Plan for user

export const updateSubscriptionForUser = AsyncHandler(
  async (req, res, next) => {
    try {
      const subId = req.params.subId || (req.params as any).id || req.body.id || req.body._id;

      if (!subId) {
        return errorHandler(res, 400, false, "subId not found", {});
      }

      const existingPlan = await SubscriptionPlanModel.findById(subId);
      if (!existingPlan) {
        return errorHandler(res, 404, false, "Subscription plan not found", {});
      }

      const allowedFields = [
        "name",
        "plan",
        "price",
        "currency",
        "description",
        "tokens",
        "durationInDays",
        "services",
        "isActive",
        "rolloverEnabled",
        "rolloverCapPercent",
      ] as const;

      const updates: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      }

      if (Object.keys(updates).length === 0) {
        return errorHandler(
          res,
          400,
          false,
          "No valid fields provided to update",
          {},
        );
      }

      const updatedPlan = await SubscriptionPlanModel.findByIdAndUpdate(
        subId,
        updates, // was: req.body (raw, unwhitelisted)
        { new: true },
      );

      console.log("update Subs :", updatedPlan);

      if (!updatedPlan) {
        return errorHandler(
          res,
          400,
          false,
          "Subscription plan not updated",
          {},
        );
      }

      return successHandler(
        res,
        200,
        true,
        "Subscription Plan Updated Successfully",
        { updatedPlan },
      );
    } catch (error) {
      console.log("error to update Subscription :", error);
      next(error);
    }
  },
);

// admin delete the Subscription

export const deleteSubscriptionForUser = AsyncHandler(
  async (req, res, next) => {
    try {
      const subId = req.params.subId;

      if (!subId) {
        return errorHandler(res, 400, false, "subId not found", {});
      }

      const existingPlan = await SubscriptionPlanModel.findById(subId);
      if (!existingPlan) {
        return errorHandler(res, 404, false, "Subscription plan not found", {});
      }

      // block hard delete if any user is actively subscribed — use isActive:false to retire instead
      const activeSubscribers = await UserSubscriptionModel.countDocuments({
        plan: subId,
        status: UserSubscriptionStatus.ACTIVE,
      });

      if (activeSubscribers > 0) {
        return errorHandler(
          res,
          409,
          false,
          `Cannot delete: ${activeSubscribers} user(s) are actively subscribed. Set isActive to false to retire this plan.`,
          {},
        );
      }

      await SubscriptionPlanModel.findByIdAndDelete(subId);

      return successHandler(
        res,
        200,
        true,
        "Subscription Plan Deleted Successfully",
        {},
      );
    } catch (error) {
      console.log("error to delete Subscription :", error);
      next(error);
    }
  },
);
