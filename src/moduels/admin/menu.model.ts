import mongoose, { Schema, Document } from "mongoose";

export interface IMenuItem extends Document {
  label: string;
  icon: string;
  target: string;
  visible: "User Menu" | "Admin Menu";
  order: number;
  isActive: boolean;
  parentId?: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
}

const menuItemSchema = new Schema<IMenuItem>(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },
    icon: {
      type: String,
      required: true,
      default: "LayoutDashboard",
    },
    target: {
      type: String,
      required: true,
      trim: true,
    },
    visible: {
      type: String,
      enum: ["User Menu", "Admin Menu", "All"],
      default: "User Menu",
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "MenuItem",
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Auth",
    },
  },
  { timestamps: true }
);

menuItemSchema.index({ visible: 1, isActive: 1, order: 1 });

export const MenuItemModel = mongoose.model<IMenuItem>("MenuItem", menuItemSchema);
