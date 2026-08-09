import { Schema, model, Model, Types } from 'mongoose';
import { ModerationCategory, ModerationSourceModule } from '@/moduels/moderation/moderation.type.js';

export interface IModerationLog {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  sourceModule: ModerationSourceModule;
  // Prompt is stored truncated, not in full — this collection exists for
  // abuse-pattern visibility and admin review, not as a verbatim archive of
  // rejected content. Mirrors the same caution used for rawResponse
  // truncation elsewhere in this codebase.
  promptExcerpt: string;
  flaggedCategories: ModerationCategory[];
  matchedCustomBlocklistTerm?: string;
  createdAt: Date;
}

const moderationLogSchema = new Schema<IModerationLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sourceModule: { type: String, enum: Object.values(ModerationSourceModule), required: true },
    promptExcerpt: { type: String, required: true, maxlength: 300 },
    flaggedCategories: [{ type: String, enum: Object.values(ModerationCategory) }],
    matchedCustomBlocklistTerm: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

moderationLogSchema.index({ userId: 1, createdAt: -1 });

export const ModerationLogModel: Model<IModerationLog> = model<IModerationLog>('ModerationLog', moderationLogSchema);

export interface IModerationBlocklistEntry {
  _id: Types.ObjectId;
  term: string; // stored lowercase, matched case-insensitively
  addedBy: Types.ObjectId;
  createdAt: Date;
}

const moderationBlocklistSchema = new Schema<IModerationBlocklistEntry>(
  {
    term: { type: String, required: true, unique: true, lowercase: true, trim: true },
    addedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const ModerationBlocklistModel: Model<IModerationBlocklistEntry> = model<IModerationBlocklistEntry>(
  'ModerationBlocklistEntry',
  moderationBlocklistSchema,
);