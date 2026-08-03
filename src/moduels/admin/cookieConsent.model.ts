import mongoose, { Schema, Document } from "mongoose";

export interface ICookieConsent extends Document {
  user: string;
  consented: boolean;
  categories: string[];
}

const cookieConsentSchema = new Schema<ICookieConsent>(
  {
    user: { type: String, required: true },
    consented: { type: Boolean, default: true },
    categories: [{ type: String }],
  },
  { timestamps: true }
);

export const CookieConsentModel = mongoose.model<ICookieConsent>("CookieConsent", cookieConsentSchema);
