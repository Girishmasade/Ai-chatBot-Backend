import { Router } from "express";
import { resendOTP, sendOTP, verifyOTP } from "./otp.controller.js";
import { validate } from "../../middlewares/zod.middleware.js";
import { verifyOTPSchema, sendOTPSchema } from "./otp.validator.js";

export const otpRouter = Router()

otpRouter.post("/send", validate(sendOTPSchema), sendOTP) // this route is used when user is not verified
otpRouter.post("/verify", validate(verifyOTPSchema), verifyOTP); // this route is used when user is not verified
otpRouter.post("/resend", validate(sendOTPSchema), resendOTP); // this route is used when user is verified