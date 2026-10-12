import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IPolicyImage {
  url: string;
  publicId?: string;
  caption?: string;
}

export interface IPrivacySection {
  title: string;
  content: string;
  order: number;
  icon?: string;
  image?: IPolicyImage;
}

export interface IThirdPartyProcessor {
  name: string;
  purpose: string;
  privacyPolicyUrl?: string;
}

export interface IPrivacyPolicy extends Document {
  title: string;
  slug: string;
  version: string;
  summary: string;
  content?: string;
  status: "draft" | "published" | "archived";
  isCurrent: boolean;
  effectiveDate: Date;
  lastUpdated: Date;
  bannerImage?: IPolicyImage;
  sections: IPrivacySection[];
  thirdPartyProcessors: IThirdPartyProcessor[];
  userRights: string[];
  securityMeasures: string[];
  contactEmail: string;
  retentionPeriod?: string;
  cookiePolicySummary?: string;
  changelog?: string;
  createdBy?: mongoose.Types.ObjectId | string;
  updatedBy?: mongoose.Types.ObjectId | string;
  createdAt: Date;
  updatedAt: Date;
}

const PolicyImageSchema = new Schema<IPolicyImage>(
  {
    url: { type: String, default: "" },
    publicId: { type: String, default: "" },
    caption: { type: String, default: "" },
  },
  { _id: false }
);

const PrivacySectionSchema = new Schema<IPrivacySection>(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    order: { type: Number, default: 0 },
    icon: { type: String, default: "Shield" },
    image: { type: PolicyImageSchema, default: undefined },
  },
  { _id: true }
);

const ThirdPartyProcessorSchema = new Schema<IThirdPartyProcessor>(
  {
    name: { type: String, required: true, trim: true },
    purpose: { type: String, required: true },
    privacyPolicyUrl: { type: String, default: "" },
  },
  { _id: false }
);

const PrivacyPolicySchema = new Schema<IPrivacyPolicy>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      default: "Privacy Policy",
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      default: "privacy-policy",
      index: true,
    },
    version: {
      type: String,
      required: true,
      trim: true,
      default: "1.0.0",
    },
    summary: {
      type: String,
      default: "",
    },
    content: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "published",
      index: true,
    },
    isCurrent: {
      type: Boolean,
      default: false,
      index: true,
    },
    effectiveDate: {
      type: Date,
      default: Date.now,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    bannerImage: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
      caption: { type: String, default: "" },
    },
    sections: {
      type: [PrivacySectionSchema],
      default: [],
    },
    thirdPartyProcessors: {
      type: [ThirdPartyProcessorSchema],
      default: [],
    },
    userRights: {
      type: [String],
      default: [],
    },
    securityMeasures: {
      type: [String],
      default: [],
    },
    contactEmail: {
      type: String,
      default: "privacy@gochat.ai",
      trim: true,
    },
    retentionPeriod: {
      type: String,
      default: "",
    },
    cookiePolicySummary: {
      type: String,
      default: "",
    },
    changelog: {
      type: String,
      default: "",
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Auth",
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "Auth",
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index to quickly find current published policy
PrivacyPolicySchema.index({ isCurrent: 1, status: 1 });
PrivacyPolicySchema.index({ slug: 1, version: 1 });

export const PrivacyPolicyModel: Model<IPrivacyPolicy> =
  mongoose.models.PrivacyPolicy ||
  mongoose.model<IPrivacyPolicy>("PrivacyPolicy", PrivacyPolicySchema);
