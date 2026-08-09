import mongoose, { Schema } from "mongoose";
import { AIService } from "./service-config.types.js";
import { ProviderConfigSchema } from "../Provider/provider-config.model.js";

export const ServiceConfigSchema = new Schema(
  {
    service: {
      type: String,
      enum: Object.values(AIService),
      required: true,
      unique: true,
    },

    enabled: {
      type: Boolean,
      default: true,
    },

    fallbackEnabled: {
      type: Boolean,
      default: true,
    },

    cacheEnabled: {
      type: Boolean,
      default: true,
    },

    providers: {
      type: [ProviderConfigSchema],
      required: true,
      validate: {
        validator: function (providers: any[]) {
          return providers.length > 0;
        },
        message: "At least one provider is required",
      },
    },

    rateLimitPerMinute: {
      type: Number,
      default: 60,
      min: 1,
    },
  },
  {
    timestamps: true,
  },
);

export const ServiceConfigModel = mongoose.model(
  "serviceConfigModel",
  ServiceConfigSchema,
);
