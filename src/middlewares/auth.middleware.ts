import { jwtAccessSecret} from "@/env/env.import.js";
import { errorHandler } from "@/utils/errorHandler.util.js";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AuthModel } from "@/moduels/auth/auth.models.js";
import { deleteRefreshToken, generateAccessToken, generateRefreshToken, keys, setTokenCookies, validateRefreshToken } from "@/utils/token.utils.js";
import redisClient from "@/config/redis.config.js";

interface jwtPayload {
  userId: string;
  role: string;
  email: string;
  username: string;
  avatar: string
  isVerified: boolean
}

// it's used for refresh if token expired

const silentRefresh = async (
  req: Request,
  res: Response,
): Promise<{ payload: jwtPayload; newAccessToken: string } | null> => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return null;

    const userId = await validateRefreshToken(refreshToken);
    if (!userId) return null;

    const user = await AuthModel.findById(userId)
      .select("_id role email username isBlocked")
      .lean();

    if (!user) return null;
    if ((user as any).isBlocked || (user as any).status === "blocked" || (user as any).status === "disabled") return null;

    // rotate tokens
    await deleteRefreshToken(refreshToken);
    const newAccessToken  = await generateAccessToken(user as any);
    const newRefreshToken = await generateRefreshToken(userId);

    //  new refresh token → cookie
    setTokenCookies(res, newRefreshToken);

    //  new access token → response header (frontend reads and stores it)
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
    };
  } catch {
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
      : null;

    //  No token → try silent refresh via cookie 
    if (!token) {
      const result = await silentRefresh(req, res);
      if (!result) return errorHandler(res, 401, false, "Unauthorized", {});

      req.user = {
        id: result.payload.userId,
        role: result.payload.role,
        email: result.payload.email,
        username: result.payload.username,
        avatar: result.payload.avatar,
        isVerified: result.payload.isVerified,
      };
      return next();
    }

    try {
      // verify JWT 
      const decoded = jwt.verify(token, jwtAccessSecret) as jwtPayload;

      // check Redis — not revoked 

      const storedToken = await redisClient.get(keys.accessToken(decoded.userId));
      if (!storedToken || storedToken !== token) {
        const result = await silentRefresh(req, res);
        if (!result) return errorHandler(res, 401, false, "Unauthorized", {});

        req.user = {
          id: result.payload.userId,
          role: result.payload.role,
          email: result.payload.email,
          username: result.payload.username,
          avatar: result.payload.avatar,
          isVerified: result.payload.isVerified,
        };
        return next();
      }

      // fetch user with high-speed Redis caching
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
      // Access Token expired → silent refresh via cookie 
      if (error.name === "TokenExpiredError") {
        const result = await silentRefresh(req, res);

        if (!result) {
          return errorHandler(res, 401, false, "Session expired, please login again", {});
        }

        req.user = {
          id: result.payload.userId,
          role: result.payload.role,
          email: result.payload.email,
          username: result.payload.username,
          avatar: result.payload.avatar,
          isVerified: result.payload.isVerified,
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
      : null;

    if (!token) {
      const result = await silentRefresh(req, res);
      if (result) {
        req.user = {
          id: result.payload.userId,
          role: result.payload.role,
          email: result.payload.email,
          username: result.payload.username,
          avatar: result.payload.avatar,
          isVerified: result.payload.isVerified,
        };
      }
      return next();
    }

    try {
      const decoded = jwt.verify(token, jwtAccessSecret) as jwtPayload;
      const storedToken = await redisClient.get(keys.accessToken(decoded.userId));

      if (storedToken && storedToken === token) {
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

        if (user && !user.isBlocked && user.status !== "blocked" && user.status !== "disabled") {
          req.user = {
            id: user._id.toString(),
            role: user.role,
            email: user.email,
            username: user.username,
            avatar: user.avatar,
            isVerified: user.isVerified,
          };
        }
      }
    } catch {
      // Ignore token verification errors in optionalAuth
    }

    return next();
  } catch (error) {
    next(error);
  }
};
// only for admin

export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== "admin") {
    return errorHandler(res, 403, false, "Access denied. Admins only.", {});
  }
  next();
};