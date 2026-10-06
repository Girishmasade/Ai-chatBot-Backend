import { jwtAccessSecret } from "@/env/env.import.js";
import { errorHandler } from "@/utils/errorHandler.util.js";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AuthModel } from "@/moduels/auth/auth.models.js";
import {
  deleteRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  getValidRefreshTokenForUser,
  keys,
  setTokenCookies,
  updateAccessTokenInDb,
  validateRefreshToken,
} from "@/utils/token.utils.js";
import redisClient from "@/config/redis.config.js";

export interface jwtPayload {
  userId: string;
  role: string;
  email: string;
  username: string;
  avatar: string;
  isVerified?: boolean;
}

// it's used for refresh if token expired or missing
export const silentRefresh = async (
  req: Request,
  res: Response,
  fallbackUserId?: string,
): Promise<{ payload: jwtPayload; newAccessToken: string; user: any } | null> => {
  try {
    // 1. Look for refresh token in cookies, headers, or request body
    let refreshToken =
      req.cookies?.refreshToken ||
      (req.headers["x-refresh-token"] as string) ||
      req.body?.refreshToken;

    let userId: string | null = null;

    if (refreshToken) {
      userId = await validateRefreshToken(refreshToken);
    }

    // 2. If cookie or header refresh token wasn't provided or valid, check MongoDB for the user's active session!
    if (!userId && fallbackUserId) {
      const dbTokenDoc = await getValidRefreshTokenForUser(fallbackUserId);
      if (dbTokenDoc) {
        userId = dbTokenDoc.userId;
        refreshToken = dbTokenDoc.token;
      }
    }

    if (!userId) return null;

    const user = await AuthModel.findById(userId)
      .select("_id role email username avatar isVerified isBlocked status")
      .lean();

    if (!user) return null;
    if (
      (user as any).isBlocked ||
      (user as any).status === "blocked" ||
      (user as any).status === "disabled"
    ) {
      return null;
    }

    // 3. Rotate tokens: remove old refresh token, generate new refresh and access tokens
    if (refreshToken) {
      await deleteRefreshToken(refreshToken);
    }

    const newAccessToken = await generateAccessToken(user as any);
    const newRefreshToken = await generateRefreshToken(userId, req);

    // 4. Save access token association in MongoDB
    await updateAccessTokenInDb(newRefreshToken, newAccessToken);

    // 5. New refresh token → cookie (with resilient options)
    setTokenCookies(res, newRefreshToken, req);

    // 6. New access token → response header (frontend reads and stores it)
    res.setHeader("x-access-token", newAccessToken);

    return {
      payload: {
        userId: user._id.toString(),
        role: user.role,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
        isVerified: user.isVerified,
      },
      newAccessToken,
      user,
    };
  } catch (err) {
    console.error("[Auth] silentRefresh error:", err);
    return null;
  }
};

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : (req.cookies?.accessToken as string) || null;

    // No token → try silent refresh via cookie / database
    if (!token) {
      const result = await silentRefresh(req, res);
      if (!result) return errorHandler(res, 401, false, "Unauthorized", {});

      req.user = {
        id: result.payload.userId,
        role: result.payload.role,
        email: result.payload.email,
        username: result.payload.username,
        avatar: result.payload.avatar,
        isVerified: Boolean(result.payload.isVerified),
      };
      return next();
    }

    try {
      // Verify JWT
      const decoded = jwt.verify(token, jwtAccessSecret) as jwtPayload;

      // Fetch user (with Redis caching)
      const userCacheKey = `cache:user:${decoded.userId}`;
      let user: any = null;

      try {
        const cachedUser = await redisClient.get(userCacheKey);
        if (cachedUser) {
          user = JSON.parse(cachedUser);
        }
      } catch (err) {
        console.error("Redis user cache read error:", err);
      }

      if (!user) {
        user = await AuthModel.findById(decoded.userId)
          .select("_id role email username avatar isVerified isBlocked status")
          .lean();

        if (user) {
          try {
            await redisClient.setEx(userCacheKey, 300, JSON.stringify(user));
          } catch (err) {
            console.error("Redis user cache write error:", err);
          }
        }
      }

      if (!user) return errorHandler(res, 404, false, "User not found", {});

      if (user.isBlocked || user.status === "blocked" || user.status === "disabled") {
        return errorHandler(res, 403, false, "Account blocked or disabled by administrator", {});
      }

      req.user = {
        id: user._id.toString(),
        role: user.role,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
        isVerified: user.isVerified,
      };

      return next();
    } catch (error: any) {
      // Access Token expired → silent refresh via cookie / database
      if (error.name === "TokenExpiredError") {
        let expiredUserId: string | undefined;
        try {
          const unverified = jwt.decode(token) as jwtPayload;
          expiredUserId = unverified?.userId;
        } catch {}

        const result = await silentRefresh(req, res, expiredUserId);

        if (!result) {
          return errorHandler(res, 401, false, "Session expired, please login again", {});
        }

        req.user = {
          id: result.payload.userId,
          role: result.payload.role,
          email: result.payload.email,
          username: result.payload.username,
          avatar: result.payload.avatar,
          isVerified: Boolean(result.payload.isVerified),
        };
        return next();
      }

      return errorHandler(res, 401, false, "Invalid token", {});
    }
  } catch (error) {
    next(error);
  }
};

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : (req.cookies?.accessToken as string) || null;

    if (!token) {
      const result = await silentRefresh(req, res);
      if (result) {
        req.user = {
          id: result.payload.userId,
          role: result.payload.role,
          email: result.payload.email,
          username: result.payload.username,
          avatar: result.payload.avatar,
          isVerified: Boolean(result.payload.isVerified),
        };
      }
      return next();
    }

    try {
      const decoded = jwt.verify(token, jwtAccessSecret) as jwtPayload;
      const user = await AuthModel.findById(decoded.userId)
        .select("_id role email username avatar isVerified isBlocked status")
        .lean();

      const u = user as any;
      if (u && !u.isBlocked && u.status !== "blocked" && u.status !== "disabled") {
        req.user = {
          id: u._id.toString(),
          role: u.role,
          email: u.email,
          username: u.username,
          avatar: u.avatar,
          isVerified: Boolean(u.isVerified),
        };
      }
    } catch {
      // If expired, try silent refresh
      const unverified = jwt.decode(token) as jwtPayload;
      const result = await silentRefresh(req, res, unverified?.userId);
      if (result) {
        req.user = {
          id: result.payload.userId,
          role: result.payload.role,
          email: result.payload.email,
          username: result.payload.username,
          avatar: result.payload.avatar,
          isVerified: Boolean(result.payload.isVerified),
        };
      }
    }

    return next();
  } catch (error) {
    next(error);
  }
};

export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== "admin") {
    return errorHandler(res, 403, false, "Access denied. Admins only.", {});
  }
  next();
};