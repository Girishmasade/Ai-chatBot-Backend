import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface ITermsImage {
  url: string;
  publicId?: string;
  caption?: string;
}

export interface ITermsSection {
  title: string;
  content: string;
  order: number;
  icon?: string;
  image?: ITermsImage;
}

export interface ITermsAndCondition extends Document {
  title: string;
  slug: string;
  version: string;
  summary: string;
  content?: string;
  status: "draft" | "published" | "archived";
  isCurrent: boolean;
  effectiveDate: Date;
  lastUpdated: Date;
  bannerImage?: ITermsImage;
  sections: ITermsSection[];
  keyHighlights: string[];
  prohibitedActivities: string[];
  governingLaw: string;
  contactEmail: string;
  changelog?: string;
  createdBy?: mongoose.Types.ObjectId | string;
  updatedBy?: mongoose.Types.ObjectId | string;
  createdAt: Date;
  updatedAt: Date;
}

const TermsImageSchema = new Schema<ITermsImage>(
  {
    url: { type: String, default: "" },
    publicId: { type: String, default: "" },
    caption: { type: String, default: "" },
  },
  { _id: false }
);

const TermsSectionSchema = new Schema<ITermsSection>(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    order: { type: Number, default: 0 },
    icon: { type: String, default: "FileText" },
    image: { type: TermsImageSchema, default: undefined },
  },
  { _id: true }
);

const TermsAndConditionSchema = new Schema<ITermsAndCondition>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      default: "Terms and Conditions",
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      default: "terms-and-conditions",
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
      type: [TermsSectionSchema],
      default: [],
    },
    keyHighlights: {
      type: [String],
      default: [],
    },
    prohibitedActivities: {
      type: [String],
      default: [],
    },
    governingLaw: {
      type: String,
      default: "Governing Law of India / Standard Enterprise Jurisdiction",
      trim: true,
    },
    contactEmail: {
      type: String,
      default: "legal@gochat.ai",
      trim: true,
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

// Indexes for rapid queries
TermsAndConditionSchema.index({ isCurrent: 1, status: 1 });
TermsAndConditionSchema.index({ slug: 1, version: 1 });

export const TermsAndConditionModel: Model<ITermsAndCondition> =
  mongoose.models.TermsAndCondition ||
  mongoose.model<ITermsAndCondition>("TermsAndCondition", TermsAndConditionSchema);
