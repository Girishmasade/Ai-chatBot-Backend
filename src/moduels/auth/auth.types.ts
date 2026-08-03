import type { z } from "zod";
import type {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  updateRoleSchema,
  socialLoginSchema,
} from "./auth.validator.js";

// z.infer is used to infer the type of the schema

// auth.types.ts
export type RegisterInput = z.infer<typeof registerSchema>["body"];
export type LoginInput = z.infer<typeof loginSchema>["body"];
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>["body"];
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>["body"];
export type SocialMediaInput = z.infer<typeof socialLoginSchema>["body"];