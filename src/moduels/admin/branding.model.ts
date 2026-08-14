import mongoose, { Schema, Document } from "mongoose";

export interface IBrandingConfig extends Document {
  appName: string;
  logoName: string;
  logoImage: string;
  mainLogo: string;
  favicon: string;
  mobileLogo: string;
  themeMode: string;
  primaryColor: string;
  accentGlow: string;
  footerText: string;
  phone: string;
  email: string;
  description: string;
  twitterUrl: string;
  linkedinUrl: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
}

const brandingSchema = new Schema<IBrandingConfig>(
  {
    appName: { type: String, default: "GoChat AI" },
    logoName: { type: String, default: "GoChat AI" },
    logoImage: { type: String, default: "" },
    mainLogo: { type: String, default: "" },
    favicon: { type: String, default: "" },
    mobileLogo: { type: String, default: "" },
    themeMode: { type: String, default: "Black Amber" },
    primaryColor: { type: String, default: "#F59E0B" },
    accentGlow: { type: String, default: "rgba(245, 158, 11, 0.15)" },
    footerText: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    description: { type: String, default: "" },
    twitterUrl: { type: String, default: "" },
    linkedinUrl: { type: String, default: "" },
    seoTitle: { type: String, default: "" },
    seoDescription: { type: String, default: "" },
    seoKeywords: { type: String, default: "" },
  },
  { timestamps: true }
);

export const BrandingModel = mongoose.model<IBrandingConfig>("BrandingConfig", brandingSchema);
