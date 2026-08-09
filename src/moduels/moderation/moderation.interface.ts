import type { ModerationCategory, ModerationSourceModule } from "./moderation.type.js";

export interface ModerationResult {
  flagged: boolean;
  categories: Partial<Record<ModerationCategory, boolean>>;
  categoryScores: Partial<Record<ModerationCategory, number>>;
  matchedCustomBlocklistTerm?: string;
}

export interface ModerationCheckInput {
  text: string;
  userId: string;
  sourceModule: ModerationSourceModule;
}
 