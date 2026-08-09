import mongoose, { Schema, Document } from "mongoose";

export interface IAuditLog extends Document {
  action: string;
  operator: string;
  details: string;
  level: "info" | "warning" | "danger";
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    action: { type: String, required: true, trim: true },
    operator: { type: String, required: true, default: "System Admin" },
    details: { type: String, required: true },
    level: { type: String, enum: ["info", "warning", "danger"], default: "info" },
  },
  { timestamps: true }
);

export const AuditLogModel = mongoose.model<IAuditLog>("AuditLog", auditLogSchema);
