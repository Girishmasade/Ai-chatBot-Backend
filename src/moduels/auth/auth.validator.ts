import { z } from "zod";

export const authSchema = z.object({
  username: z.string().trim().min(6, "Username must be at least 6 characters"),
  avatar:   z.string().url("Invalid avatar URL").optional(),
  email:    z.string().email("Invalid email address").toLowerCase(),
  role:     z.enum(["user", "admin"]).default("user"),
  isVerified: z.boolean().default(false),
  googleId: z.string().optional(),
  githubId: z.string().optional(),
  facebookId: z.string().optional(),
});

export const registerSchema = z.object({
  body: z.object({
    username: z.string().trim().min(6, "Username must be at least 6 characters"),
    email: z.string().email("Invalid email address").toLowerCase(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address").toLowerCase(),
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    username: z.string().trim().min(6, "Username must be at least 6 characters"),
    avatar:   z.string().url("Invalid avatar URL").optional(),
  }),
});

export const updateRoleSchema = z.object({
  body: z.object({
    role:    z.enum(["user", "admin"]),
  }),
});

export const socialLoginSchema = z.object({
  body: z.object({
    googleId: z.string().optional(),
    githubId: z.string().optional(),
    facebookId: z.string().optional(),
  }),
});