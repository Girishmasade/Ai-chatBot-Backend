import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import redisClient from "../../config/redis.config.js";
import { successHandler } from "../../utils/successHandler.util.js";
import crypto from "crypto";
import { AuthModel, type Auth } from "../auth/auth.models.js";
import type { SendOTPInput, VerifyOTPInput } from "./otp.validator.js";
import { emailQueue } from "../../redis/scheduler/queue.registry.js";
import { JobName } from "../../shared/shared.types.enum.js";
import { errorHandler } from "../../utils/errorHandler.util.js";
import {
  generateAccessToken,
  generateRefreshToken,
  setTokenCookies,
} from "@/utils/token.utils.js";
import { initWallet } from "../token/tokenWallet/tokenWallet.controller.js";
import {
  assignPlanToUser,
  getFreePlanId,
} from "../subscription/Subscription.assign.js";
import { node_env } from "@/env/env.import.js";
import { sendOTPToEmail } from "./otp.utils.js";

// redis keys

const OTP_PREFIX = "otp:";
const OTP_TTL = 200;
const MAX_RETRIES = 3;
const RETRY_PREFIX = "otp:retries:";
const RETRY_TTL = 200;

// crypto js for generate otp

const generateOTP = (): string => {
  // generates a cryptographically secure 6-digit OTP
  return crypto.randomInt(100000, 999999).toString(); // 100000 - 999999 range of 6 digits
};

// The function to send otp */*/*/*/*/*

export const sendOTP = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email } = req.body;

    if (!email) {
      return errorHandler(res, 400, false, "Email is required", {});
    }

    const user = await AuthModel.findOne({ email });

    if (!user) {
      return errorHandler(res, 404, false, "User not found", {});
    }

    if (user.isVerified) {
      return errorHandler(res, 400, false, "Email is already verified.", {});
    }

    const retries = await redisClient.get(`${RETRY_PREFIX}${email}`);

    // console.log("retries : ", retries);

    if (retries && parseInt(retries) >= MAX_RETRIES) {
      return errorHandler(
        res,
        429,
        false,
        "Too many requests, please try again later",
        {},
      );
    }

    await sendOTPToEmail(email, user.username);

    return successHandler(res, 200, true, "OTP sent to your email.", {
      ...(node_env === "development" && { otp: await redisClient.get(`${OTP_PREFIX}${email}`) }),
    });
  } catch (error) {
    console.log("error to send otp : ,", error);
    next(error);
  }
};

// The function to verify otp */*/*/*/*/*

export const verifyOTP = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email, otp } = req.body as VerifyOTPInput;

    if (!email || !otp) {
      return errorHandler(res, 400, false, "Email and OTP are required", {});
    }

    const storedOTP = await redisClient.get(`${OTP_PREFIX}${email}`);
    if (!storedOTP) {
      return errorHandler(res, 400, false, "OTP is invalid or expired", {});
    }

    if (storedOTP.length !== otp.length) {
      return errorHandler(res, 400, false, "OTP is invalid or expired", {});
    }

    const isValid = crypto.timingSafeEqual(
      Buffer.from(storedOTP),
      Buffer.from(otp),
    );

    if (!isValid) {
      await redisClient.incr(`${RETRY_PREFIX}${email}`);
      await redisClient.expire(`${RETRY_PREFIX}${email}`, RETRY_TTL);
      return successHandler(res, 400, false, "OTP is invalid or expired", {});
    }

    // ── Verification + wallet creation + free plan assignment, atomically ──────
    // If the free-plan credit fails for any reason (e.g. no "Free" plan seeded
    // yet), the isVerified flip must roll back too — otherwise we'd end up
    // with verified users who silently never got a wallet or tokens, which is
    // exactly the "wallet collection is empty" bug already hit once.
    const session = await mongoose.startSession();
    let user: Auth | undefined;
    let tokensCredited = 0;

    try {
      await session.withTransaction(async () => {
        const updatedUser = await AuthModel.findOneAndUpdate(
          { email },
          { $set: { isVerified: true } },
          { new: true, session },
        );

        if (!updatedUser) {
          throw new Error("User not found");
        }

        const userId = updatedUser._id.toString();

        // Wallet must exist before assignPlanToUser can credit it.
        // initWallet() is idempotent, so this is safe even if called twice.
        await initWallet(userId, session);

        const freePlanId = await getFreePlanId(session);
        const result = await assignPlanToUser(userId, freePlanId, session);

        tokensCredited = result.tokensCredited;
        user = updatedUser;
      });
    } finally {
      await session.endSession();
    }

    if (!user) {
      return errorHandler(res, 404, false, "User not found", {});
    }

    await redisClient.del(`${OTP_PREFIX}${email}`);
    await redisClient.del(`${RETRY_PREFIX}${email}`);

    const accessToken = await generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user._id.toString());

    setTokenCookies(res, refreshToken);

    // Notify Admin Real-Time & Log Audit
    try {
      const { emitAdminEntityUpdate } = await import("@/socket/socket.emitter.js");
      const { AuditLogModel } = await import("../admin/auditLog.model.js");
      
      emitAdminEntityUpdate({
        entityType: "user",
        action: "created",
        data: {
          id: user._id.toString(),
          name: user.username,
          email: user.email,
          role: user.role,
          tier: "Free",
          credits: tokensCredited,
        },
      });

      await AuditLogModel.create({
        action: "New Registration",
        operator: user.username,
        details: `User ${user.email} registered and received ${tokensCredited} initial tokens`,
        level: "info",
      });
    } catch (e) {
      console.error("Admin notification failed:", e);
    }

    console.log(
      `Verified ${email} — credited ${tokensCredited} free-plan tokens`,
    );

    return successHandler(res, 200, true, "Email verified successfully.", {
      accessToken,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.log("error to verify otp :", error);
    next(error);
  }
};

// The function to resend otp */*/*/*/*/*

export const resendOTP = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email } = req.body as SendOTPInput;

    if (!email) {
      return successHandler(res, 400, false, "Email is required", {});
    }

    const user = await AuthModel.findOne({ email });

    if (!user) {
      return successHandler(res, 404, false, "User not found", {});
    }

    if (user.isVerified) {
      return successHandler(res, 400, false, "Email is already verified.", {});
    }

    const retries = await redisClient.get(`${RETRY_PREFIX}${email}`);

    console.log("retries : ", retries);

    if (retries && parseInt(retries) >= MAX_RETRIES) {
      return successHandler(
        res,
        429,
        false,
        "Too many requests, please try again later",
        {},
      );
    }

    await sendOTPToEmail(email, user.username);

    return successHandler(res, 200, true, "OTP sent to your email.", {
      ...(node_env === "development" && { otp: await redisClient.get(`${OTP_PREFIX}${email}`) }),
    });
  } catch (error) {
    console.error("error in the resend otp :", error);
    next(error);
  }
};
