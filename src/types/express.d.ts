import type { AuthUser } from "@/moduels/auth/auth.payload.js";

declare global {
  namespace Express {
    interface User extends AuthUser {} // 👈 Passport user

    interface Request {
      user?: AuthUser; // 👈 req.user
    }
  }
}

export {};
