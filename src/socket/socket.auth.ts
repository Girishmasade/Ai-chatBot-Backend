/**
 * Socket.IO authentication middleware.
 *
 * Verifies the JWT sent in `socket.handshake.auth.token` and attaches
 * the decoded user payload to `socket.data.user`.
 *
 * Mirrors the HTTP auth middleware's logic:
 *  1. Decode & verify the JWT signature.
 *  2. Validate the token against Redis (not revoked).
 *  3. Confirm the user still exists in Mongo and isn't blocked.
 */

import type { Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { jwtAccessSecret } from "@/env/env.import.js";
import redisClient from "@/config/redis.config.js";
import { AuthModel } from "@/moduels/auth/auth.models.js";
import { keys } from "@/utils/token.utils.js";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "./socket.types.js";

type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

interface JwtPayload {
  userId: string;
  role: string;
  email: string;
  username: string;
}

/**
 * Apply as `io.use(socketAuthMiddleware)`.
 */
export const socketAuthMiddleware = async (
  socket: AppSocket,
  next: (err?: Error) => void,
): Promise<void> => {
  try {
    const token = socket.handshake.auth?.token as string | undefined;

    if (!token) {
      return next(new Error("Authentication error: token missing"));
    }

    // 1. Verify JWT signature
    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, jwtAccessSecret) as JwtPayload;
    } catch {
      return next(new Error("Authentication error: invalid token"));
    }

    // 2. Check Redis — token not revoked
    const storedToken = await redisClient.get(keys.accessToken(decoded.userId));
    if (!storedToken || storedToken !== token) {
      return next(new Error("Authentication error: token revoked"));
    }

    // 3. Confirm user exists and isn't blocked
    const user = await AuthModel.findById(decoded.userId)
      .select("_id role email username isBlocked")
      .lean();

    if (!user) {
      return next(new Error("Authentication error: user not found"));
    }

    if ((user as any).isBlocked) {
      return next(new Error("Authentication error: account blocked"));
    }

    // Attach user data to socket
    socket.data.user = {
      userId: user._id.toString(),
      role: user.role,
      email: user.email,
      username: user.username,
    };

    next();
  } catch (err) {
    console.error("[Socket Auth] Unexpected error:", err);
    next(new Error("Authentication error: internal server error"));
  }
};
