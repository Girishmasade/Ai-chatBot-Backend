import mongoose, { Schema, type Document } from "mongoose";

export interface Auth extends Document {
  username: string;
  avatar: string;
  email: string;
  role: "user" | "admin";
  isVerified: boolean;
  googleId?: string;
  githubId?: string;
  facebookId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const authSchema = new Schema<Auth>(
  {
    username: { type: String, required: true, trim: true },
    avatar:   { type: String },
    email:    { type: String, required: true, unique: true, lowercase: true },
    role:     { type: String, enum: ["user", "admin"], default: "user" },
    isVerified: { type: Boolean, default: false },
    googleId: { type: String },
    githubId: { type: String },
    facebookId: { type: String },
  },
  { timestamps: true }
);

export const AuthModel = mongoose.model<Auth>("Auth", authSchema);