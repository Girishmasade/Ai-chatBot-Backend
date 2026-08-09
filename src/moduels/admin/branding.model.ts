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
    footerText: { type: String, default: "The luxury standard for multi-modal intelligence workspace solutions." },
    phone: { type: String, default: "+91 (80) 4125-9900" },
    email: { type: String, default: "support@gochat.ai" },
    description: { type: String, default: "The luxury standard for multi-modal intelligence workspace solutions." },
    twitterUrl: { type: String, default: "https://twitter.com/gochatai" },
    linkedinUrl: { type: String, default: "https://linkedin.com/company/gochatai" },
  },
  { timestamps: true }
);

export const BrandingModel = mongoose.model<IBrandingConfig>("BrandingConfig", brandingSchema);
