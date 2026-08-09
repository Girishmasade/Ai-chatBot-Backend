import mongoose, { Schema, Document } from "mongoose";

export interface ISystemModel extends Document {
  name: string;
  version: string;
  type: string;
  status: "active" | "inactive";
  latency: string;
  description: string;
  provider: string;
  cost: string;
  tier: string;
}

const systemModelSchema = new Schema<ISystemModel>(
  {
    name: { type: String, required: true },
    version: { type: String, required: true, unique: true },
    type: { type: String, required: true, default: "text" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    latency: { type: String, default: "250ms" },
    description: { type: String, default: "" },
    provider: { type: String, default: "Google DeepMind" },
    cost: { type: String, default: "1 cr / query" },
    tier: { type: String, default: "Core Suite" },
  },
  { timestamps: true }
);

export const SystemModelModel = mongoose.model<ISystemModel>("SystemModel", systemModelSchema);
