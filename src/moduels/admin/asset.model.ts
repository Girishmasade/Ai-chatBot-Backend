import mongoose, { Schema, Document, Types } from "mongoose";

export interface IAIAsset extends Omit<Document, "model"> {
  user: Types.ObjectId;
  type: "image" | "video" | "text";
  title: string;
  prompt: string;
  content: string;
  model: string;
}

const aiAssetSchema = new Schema<IAIAsset>(
  {
    user: { type: Schema.Types.ObjectId, ref: "Auth", required: true },
    type: { type: String, enum: ["image", "video", "text"], required: true },
    title: { type: String, required: true },
    prompt: { type: String, default: "" },
    content: { type: String, required: true },
    model: { type: String, default: "gemini-1.5-flash" },
  },
  { timestamps: true }
);

export const AIAssetModel = mongoose.model<IAIAsset>("AIAsset", aiAssetSchema);
