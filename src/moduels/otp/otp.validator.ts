import { z } from "zod";

export const sendOTPSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const verifyOTPSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address"),
    otp: z.string().length(6, "OTP must be 6 digits"),
  }),
});

export type SendOTPInput = z.infer<typeof sendOTPSchema>
export type VerifyOTPInput = z.infer<typeof verifyOTPSchema>["body"];
