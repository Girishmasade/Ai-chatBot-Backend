import redisClient from "@/config/redis.config.js";
import { jwtAccessSecret } from "@/env/env.import.js";
import { AuthModel } from "@/moduels/auth/auth.models.js";
import { errorHandler } from "@/utils/errorHandler.util.js";
import { keys } from "@/utils/token.utils.js";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Types } from "mongoose";

interface JwtPayload {
  userId: string;   
  role: string;
  email: string;
  username: string;
}

export const socialMediaMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = req.headers.authorization?.split(" ")[1] || req.cookies.accessToken 

    if (!token) {
      return errorHandler(res, 401, false, "Unauthorized", {});
    }

    // verify JWT
    const decoded = jwt.verify(token, jwtAccessSecret) as JwtPayload;  // ✅ new secret

    // check Redis
    const storedToken = await redisClient.get(keys.accessToken(decoded.userId));

    if (!storedToken || storedToken !== token) {
      return errorHandler(res, 401, false, "Token revoked or expired", {});
    }

    // fetch user 
    const user = await AuthModel.findById(decoded.userId)
      .select("_id role email username avatar googleId githubId facebookId isBlocked")
      .lean();

    if (!user) return errorHandler(res, 404, false, "User not found", {});

    req.user = {
      id: (user._id as Types.ObjectId).toString(),
      role: user.role,
      email: user.email,
      username: user.username,
      googleId: user.googleId,
      githubId: user.githubId,
      facebookId: user.facebookId,
    };

    next();
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      return errorHandler(res, 401, false, "Token expired", {});
    }
    return errorHandler(res, 401, false, "Invalid token", {});
  }
};