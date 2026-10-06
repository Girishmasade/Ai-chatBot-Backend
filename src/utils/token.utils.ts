import jwt from "jsonwebtoken";
import { type Request, type Response } from "express";
import redisClient from "@/config/redis.config.js";
import crypto from "crypto";
import type { Auth } from "../moduels/auth/auth.models.js";
import { jwtAccessSecret, node_env } from "@/env/env.import.js";
import { RefreshTokenModel } from "../moduels/auth/refreshToken.model.js";

const ACCESS_TTL = 15 * 60; // 15 mins in seconds
const REFRESH_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

// jwt payload
export interface JwtPayload {
  userId: string;
  username: string;
  email: string;
  role: string;
  avatar: string;
  isVerified?: boolean;
}

// redis keys
export const keys = {
  accessToken: (userId: string) => `access_token:${userId}`,
  refreshToken: (token: string) => `refresh_token:${token}`,
  userToken: (userId: string) => `user_token:${userId}`,
};

// generate the access token
export const generateAccessToken = async (user: Auth) => {
  const payload: JwtPayload = {
    userId: user._id.toString(),
    email: user.email,
    username: user.username,
    avatar: user.avatar,
    role: user.role,
    isVerified: user.isVerified,
  };

  const token = jwt.sign(payload, jwtAccessSecret, { expiresIn: "15m" });

  try {
    await redisClient.setEx(
      keys.accessToken(user._id.toString()),
      ACCESS_TTL,
      token,
    );
  } catch (err) {
    console.error("[Token] Redis accessToken cache write error:", err);
  }

  return token;
};

// generate the refresh token (persisted in MongoDB and cached in Redis)
export const generateRefreshToken = async (
  userId: string,
  req?: Request,
): Promise<string> => {
  const token = crypto.randomBytes(64).toString("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TTL * 1000);

  // 1. Store in MongoDB database
  try {
    await RefreshTokenModel.create({
      userId,
      token,
      expiresAt,
      deviceInfo: req?.headers?.["user-agent"] || "Browser",
      ipAddress: req?.ip || req?.socket?.remoteAddress,
    });
  } catch (err) {
    console.error("[Token] MongoDB refreshToken write error:", err);
  }

  // 2. Cache in Redis
  try {
    await redisClient.setEx(keys.refreshToken(token), REFRESH_TTL, userId);
    await redisClient.sAdd(keys.userToken(userId), token);
    await redisClient.expire(keys.userToken(userId), REFRESH_TTL);
  } catch (err) {
    console.error("[Token] Redis refreshToken cache write error:", err);
  }

  return token;
};

// associate the access token with the refresh token in MongoDB
export const updateAccessTokenInDb = async (
  refreshToken: string,
  accessToken: string,
): Promise<void> => {
  try {
    await RefreshTokenModel.updateOne(
      { token: refreshToken },
      { $set: { accessToken } },
    );
  } catch (err) {
    console.error("[Token] Failed to associate accessToken with refreshToken in DB:", err);
  }
};

// validate refresh token (checks Redis first, falls back to MongoDB)
export const validateRefreshToken = async (
  token: string,
): Promise<string | null> => {
  if (!token) return null;

  // 1. Check Redis cache
  try {
    const cachedUserId = await redisClient.get(keys.refreshToken(token));
    if (cachedUserId) return cachedUserId;
  } catch (err) {
    console.error("[Token] Redis validateRefreshToken read error:", err);
  }

  // 2. Fallback to MongoDB database
  try {
    const doc = await RefreshTokenModel.findOne({
      token,
      expiresAt: { $gt: new Date() },
    });

    if (doc) {
      const userId = doc.userId.toString();
      // Re-populate Redis cache
      try {
        await redisClient.setEx(keys.refreshToken(token), REFRESH_TTL, userId);
        await redisClient.sAdd(keys.userToken(userId), token);
      } catch (cacheErr) {
        console.error("[Token] Failed to re-cache refreshToken to Redis:", cacheErr);
      }
      return userId;
    }
  } catch (dbErr) {
    console.error("[Token] MongoDB validateRefreshToken read error:", dbErr);
  }

  return null;
};

// retrieve the most recent valid refresh token for a user from MongoDB
export const getValidRefreshTokenForUser = async (
  userId: string,
): Promise<{ token: string; userId: string } | null> => {
  if (!userId) return null;

  try {
    const doc = await RefreshTokenModel.findOne({
      userId,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (doc) {
      return {
        token: doc.token,
        userId: doc.userId.toString(),
      };
    }
  } catch (err) {
    console.error("[Token] MongoDB getValidRefreshTokenForUser error:", err);
  }

  return null;
};

// Delete single refresh token (from both MongoDB and Redis)
export const deleteRefreshToken = async (token: string): Promise<void> => {
  if (!token) return;

  // Delete from MongoDB
  try {
    await RefreshTokenModel.deleteOne({ token });
  } catch (dbErr) {
    console.error("[Token] MongoDB deleteRefreshToken error:", dbErr);
  }

  // Delete from Redis
  try {
    const userId = await redisClient.get(keys.refreshToken(token));
    if (userId) {
      await redisClient.sRem(keys.userToken(userId), token);
    }
    await redisClient.del(keys.refreshToken(token));
  } catch (redisErr) {
    console.error("[Token] Redis deleteRefreshToken error:", redisErr);
  }
};

// Delete refresh token from all devices
export const deleteRefreshTokenFromAllDevices = async (
  userId: string,
): Promise<void> => {
  if (!userId) return;

  // Delete all from MongoDB
  try {
    await RefreshTokenModel.deleteMany({ userId });
  } catch (dbErr) {
    console.error("[Token] MongoDB deleteRefreshTokenFromAllDevices error:", dbErr);
  }

  // Delete from Redis
  try {
    const tokens: string[] = await redisClient.sMembers(keys.userToken(userId));
    if (tokens.length > 0) {
      await Promise.all(tokens.map((t) => redisClient.del(keys.refreshToken(t))));
    }
    await redisClient.del(keys.accessToken(userId));
    await redisClient.del(keys.userToken(userId));
  } catch (redisErr) {
    console.error("[Token] Redis deleteRefreshTokenFromAllDevices error:", redisErr);
  }
};

// determine resilient cookie options for both localhost and production
export const getCookieOptions = (req?: Request) => {
  const isHttps =
    req?.secure ||
    req?.headers?.["x-forwarded-proto"] === "https" ||
    (typeof process.env.FRONTEND_URL === "string" &&
      process.env.FRONTEND_URL.startsWith("https"));

  const isProduction =
    node_env === "production" &&
    isHttps &&
    !req?.headers?.host?.includes("localhost") &&
    !req?.headers?.host?.includes("127.0.0.1");

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? ("none" as const) : ("lax" as const),
    path: "/",
    maxAge: REFRESH_TTL * 1000,
  };
};

// set token as cookies
export const setTokenCookies = (
  res: Response,
  refreshToken: string,
  req?: Request,
): void => {
  const options = getCookieOptions(req);
  res.cookie("refreshToken", refreshToken, options);
};

// clear token cookies
export const clearTokenCookies = (res: Response, req?: Request): void => {
  const options = getCookieOptions(req);
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: options.secure,
    sameSite: options.sameSite,
    path: "/",
  });
};
