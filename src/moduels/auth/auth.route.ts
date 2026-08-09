import { Router } from "express";
import { loginAccount, registerAccount, logoutAccount, logoutAllDevices } from "./auth.controller.js";
import { validate } from "../../middlewares/zod.middleware.js";
import { loginSchema, registerSchema } from "./auth.validator.js";
import { facebookCallback, facebookLogin, githubCallback, githubLogin, googleCallback, googleLogin } from "./socialmedia.auth.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";

export const authRouter = Router()

authRouter.post("/register", validate(registerSchema), registerAccount)
authRouter.post("/login", validate(loginSchema), loginAccount)
authRouter.post("/logout", authMiddleware, logoutAccount)
authRouter.post("/logout-all", authMiddleware, logoutAllDevices)

// google authantication

authRouter.get("/google", googleLogin)
authRouter.get("/google/callback", googleCallback)

// github auth

authRouter.get("/github", githubLogin);
authRouter.get("/github/callback", githubCallback);

// facebook auth
authRouter.get("/facebook", facebookLogin);
authRouter.get("/facebook/callback", facebookCallback);