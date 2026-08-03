import type { NextFunction, Request, Response } from "express";
import passport from "passport";
import {
  generateAccessToken,
  generateRefreshToken,
  setTokenCookies,
} from "../../utils/token.utils.js";
import { initWallet } from "../token/tokenWallet/tokenWallet.controller.js";
import { assignPlanToUser, getFreePlanId } from "../subscription/Subscription.assign.js";
import mongoose from "mongoose";

const oauthCallback =
  (strategy: string) => (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate(
      strategy,
      { failureRedirect: `${process.env.FRONTEND_URL}/login` },
      async (err: any, user: any) => {
        if (err || !user) return res.redirect(`${process.env.FRONTEND_URL}/login`);

        // Initialize wallet and assign free plan if the user is new or hasn't received them
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
          const userIdStr = user._id.toString();
          await initWallet(userIdStr, session);
          const freePlanId = await getFreePlanId(session);
          await assignPlanToUser(userIdStr, freePlanId, session);
          await session.commitTransaction();
        } catch (error) {
          await session.abortTransaction();
          console.error("Failed to initialize wallet/plan for OAuth user:", error);
        } finally {
          session.endSession();
        }

        const accessToken = await generateAccessToken(user);
        const refreshToken = await generateRefreshToken(user._id.toString()) as string;

        // store refreshToken in HttpOnly cookie
        setTokenCookies(res, refreshToken);

        // We can pass accessToken via URL so frontend can easily capture it, or rely on silentRefresh.
        // I will pass it as a URL parameter to be safe.
        return res.redirect(`${process.env.FRONTEND_URL}/?token=${accessToken}`);
      },
    )(req, res, next);
  };

// ─── Google ──────────────────────────────────────────────────────────────────

export const googleLogin = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
    session: false
  })(req, res, next);
};

export const googleCallback = oauthCallback("google");

// ─── GitHub ──────────────────────────────────────────────────────────────────

export const githubLogin = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  passport.authenticate("github", {
    scope: ["user:email"], // correct GitHub scope
    session: false
  })(req, res, next);
};

export const githubCallback = oauthCallback("github");

// ─── Facebook ────────────────────────────────────────────────────────────────

export const facebookLogin = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  passport.authenticate("facebook", {
    scope: ["public_profile", "email"], // correct Facebook scopes, no prompt
    session: false
  })(req, res, next);
};

export const facebookCallback = oauthCallback("facebook");
