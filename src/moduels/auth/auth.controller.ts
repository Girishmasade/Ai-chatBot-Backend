import type { NextFunction, Request, Response } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { AuthModel } from "./auth.models.js";
import redisClient from "../../config/redis.config.js";
import { successHandler } from "../../utils/successHandler.util.js";
import type { LoginInput, RegisterInput } from "./auth.types.js";
import { errorHandler } from "../../utils/errorHandler.util.js";
import { sendOTPToEmail } from "../otp/otp.utils.js";
import {
  clearTokenCookies,
  deleteRefreshToken,
  deleteRefreshTokenFromAllDevices,
  validateRefreshToken,
} from "@/utils/token.utils.js";
import { silentRefresh } from "@/middlewares/auth.middleware.js";

const OTP_PREFIX = "otp:";
const RETRY_PREFIX = "otp:retries:";
const MAX_RETRIES = 5;

// ── Register

export const registerAccount = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { username, email } = req.body as RegisterInput;

    const existingUser = await AuthModel.findOne({ email });
    if (existingUser) {
      successHandler(res, 409, false, "Email already registered.", {});
      return;
    }

    const retries = await redisClient.get(`${RETRY_PREFIX}${email}`);
    if (retries && parseInt(retries) >= MAX_RETRIES) {
      return errorHandler(res, 429, false, "Too many attempts. Please try again later.", {});
    }

    const newUser = await AuthModel.create({
      username,
      email,
      isVerified: false,
    });

    console.log("new user : ", newUser);

    const sendotp = await sendOTPToEmail(email, newUser.username);

    console.log("sendotp :", sendotp);

    successHandler(res, 201, true, "Account created. OTP sent to your email.", {
      id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      isVerified: newUser.isVerified,
    });
  } catch (error) {
    console.log("error to register Account :", error);
    next(error);
  }
};

// Login OTP

export const loginAccount = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email } = req.body as LoginInput;

    if (!email) {
      return errorHandler(res, 400, false, "Email is required", {});
    }

    const isUserExists = await AuthModel.findOne({ email });

    if (!isUserExists) {
      return errorHandler(res, 404, false, "User not found", {});
    }

    if (!isUserExists?.isVerified) {
      return errorHandler(res, 400, false, "User is not verified", {});
    }

    // track login attempts
    const retries = await redisClient.get(`${RETRY_PREFIX}${email}`);
    if (retries && parseInt(retries) >= MAX_RETRIES) {
      return errorHandler(res, 429, false, "Too many attempts. Please try again later.", {});
    }

    await sendOTPToEmail(email, isUserExists.username);

    successHandler(res, 200, true, "OTP sent to your email.", {});
  } catch (error) {
    console.log("error to login Account :", error);
    next(error);
  }
};

// Refresh Token: generates fresh access & refresh tokens from cookie or DB
export const refreshTokenAccount = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let fallbackUserId: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const decoded = jwt.decode(authHeader.split(" ")[1]) as any;
        fallbackUserId = decoded?.userId;
      } catch {}
    }

    const result = await silentRefresh(req, res, fallbackUserId);

    if (!result) {
      return errorHandler(res, 401, false, "Session expired or invalid refresh token. Please login again.", {});
    }

    return successHandler(res, 200, true, "Token refreshed successfully.", {
      accessToken: result.newAccessToken,
      user: {
        id: result.payload.userId,
        username: result.payload.username,
        email: result.payload.email,
        role: result.payload.role,
        avatar: result.payload.avatar,
      },
    });
  } catch (error) {
    console.error("error in refreshTokenAccount:", error);
    next(error);
  }
};

// logout

export const logoutAccount = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token =
      req.cookies?.refreshToken ||
      (req.headers["x-refresh-token"] as string) ||
      req.body?.refreshToken;

    if (token) {
      await deleteRefreshToken(token);
    }

    if (req.user?.id) {
      await deleteRefreshTokenFromAllDevices(req.user.id);
    }

    clearTokenCookies(res, req);

    return successHandler(res, 200, true, "Logged out successfully.", {});
  } catch (error) {
    console.log("error to logout Account :", error);
    next(error);
  }
};

// logout from all devices

export const logoutAllDevices = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token =
      req.cookies?.refreshToken ||
      (req.headers["x-refresh-token"] as string) ||
      req.body?.refreshToken;

    let targetUserId = req.user?.id;

    if (!targetUserId && token) {
      targetUserId = (await validateRefreshToken(token)) || undefined;
    }

    if (!targetUserId) {
      return errorHandler(res, 401, false, "No valid session or refresh token provided", {});
    }

    await deleteRefreshTokenFromAllDevices(targetUserId);
    clearTokenCookies(res, req);

    return successHandler(res, 200, true, "Logged out from all devices.", {});
  } catch (error) {
    next(error);
  }
};