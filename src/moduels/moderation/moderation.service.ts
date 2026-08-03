import { Types } from 'mongoose';
import { ApiError } from '@/utils/apiError.util.js';
import {
  type ModerationResult,
  type ModerationCheckInput,
} from '@/moduels/moderation/moderation.interface.js';
import { ModerationCategory } from '@/moduels/moderation/moderation.type.js';
import {
  BLOCKED_CATEGORIES,
  MODERATION_BLOCKED_MESSAGE,
  HF_MODERATION_MODELS,
  CATEGORY_MODEL_MAP,
  MODERATION_SCORE_THRESHOLD,
  MODERATION_MAX_RETRIES,
  MODERATION_RETRY_BASE_DELAY_MS,
  HF_INFERENCE_API_BASE,
} from '@/config/moderation.config.js';
import { ModerationLogModel, ModerationBlocklistModel } from '@/moduels/moderation/moderation.model.js';
import type { IModerationLog } from '@/moduels/moderation/moderation.model.js';

async function checkCustomBlocklist(text: string): Promise<string | undefined> {
  const lowerText = text.toLowerCase();
  const entries = await ModerationBlocklistModel.find().select('term').lean();
  for (const entry of entries) {
    if (lowerText.includes(entry.term)) {
      return entry.term;
    }
  }
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeClassificationResponse(data: unknown): Array<{ label: string; score: number }> {
  if (Array.isArray(data) && Array.isArray(data[0])) {
    return data[0] as Array<{ label: string; score: number }>;
  }
  if (Array.isArray(data)) {
    return data as Array<{ label: string; score: number }>;
  }
  throw new ApiError(502, 'Unexpected classification response shape from Hugging Face Inference API');
}

async function classifyText(modelId: string, text: string): Promise<Array<{ label: string; score: number }>> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    throw new Error('HUGGINGFACE_API_KEY is not set — required for content moderation');
  }

  const url = `${HF_INFERENCE_API_BASE}/${modelId}`;

  for (let attempt = 0; attempt <= MODERATION_MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: text,
        options: { wait_for_model: true },
      }),
    });

    if (response.status === 503 || response.status === 429) {
      await sleep(MODERATION_RETRY_BASE_DELAY_MS * 2 ** attempt);
      continue;
    }

    if (!response.ok) {
      const body = await response.text();
      throw new ApiError(502, `Hugging Face moderation model error (${response.status}): ${body.slice(0, 300)}`);
    }

    const data = await response.json();
    return normalizeClassificationResponse(data);
  }

  throw new ApiError(502, `Hugging Face moderation model (${modelId}) failed after ${MODERATION_MAX_RETRIES} retries`);
}

/**
 * Calls each distinct model referenced in CATEGORY_MODEL_MAP exactly once
 * (not once per category — toxic-bert covers 5 of our categories from a
 * single call), then maps each category to its corresponding label's score.
 */
async function callHuggingFaceModeration(text: string): Promise<{
  flagged: boolean;
  categories: Partial<Record<ModerationCategory, boolean>>;
  categoryScores: Partial<Record<ModerationCategory, number>>;
}> {
  const uniqueModelKeys = [...new Set(Object.values(CATEGORY_MODEL_MAP).map((entry) => entry!.model))];

  const resultsByModel = new Map<string, Array<{ label: string; score: number }>>();
  await Promise.all(
    uniqueModelKeys.map(async (modelKey) => {
      const modelId = HF_MODERATION_MODELS[modelKey];
      const result = await classifyText(modelId, text);
      resultsByModel.set(modelKey, result);
    }),
  );

  const categories: Partial<Record<ModerationCategory, boolean>> = {};
  const categoryScores: Partial<Record<ModerationCategory, number>> = {};

  for (const [category, mapping] of Object.entries(CATEGORY_MODEL_MAP) as Array<
    [ModerationCategory, { model: keyof typeof HF_MODERATION_MODELS; label: string }]
  >) {
    const modelResults = resultsByModel.get(mapping.model) ?? [];
    const labelMatch = modelResults.find((r) => r.label.toLowerCase() === mapping.label.toLowerCase());
    const score = labelMatch?.score ?? 0;

    categoryScores[category] = score;
    categories[category] = score >= MODERATION_SCORE_THRESHOLD;
  }

  const flagged = Object.values(categories).some(Boolean);

  return { flagged, categories, categoryScores };
}

export async function moderateText(text: string): Promise<ModerationResult> {
  const customMatch = await checkCustomBlocklist(text);
  if (customMatch) {
    return {
      flagged: true,
      categories: {},
      categoryScores: {},
      matchedCustomBlocklistTerm: customMatch,
    };
  }

  const hfResult = await callHuggingFaceModeration(text);

  // "Flagged" per our policy is narrower than raw category hits — only the
  // categories in BLOCKED_CATEGORIES cause a reject. Categories with no HF
  // mapping (SELF_HARM*, SEXUAL_MINORS) will never appear here since
  // CATEGORY_MODEL_MAP has no entry for them — see the warning in
  // moderation.config.ts.
  const triggeredBlockedCategory = BLOCKED_CATEGORIES.some((cat) => hfResult.categories[cat]);

  return {
    flagged: triggeredBlockedCategory,
    categories: hfResult.categories,
    categoryScores: hfResult.categoryScores,
  };
}

export async function moderateOrThrow(input: ModerationCheckInput): Promise<void> {
  const result = await moderateText(input.text);

  if (!result.flagged) return;

  const flaggedCategories = Object.entries(result.categories)
    .filter(([, isFlagged]) => isFlagged)
    .map(([category]) => category as ModerationCategory);

  await ModerationLogModel.create({
    userId: new Types.ObjectId(input.userId),
    sourceModule: input.sourceModule,
    promptExcerpt: input.text.slice(0, 300),
    flaggedCategories,
    matchedCustomBlocklistTerm: result.matchedCustomBlocklistTerm,
  });

  throw new ApiError(400, MODERATION_BLOCKED_MESSAGE);
}

export async function listBlocklistTerms(): Promise<Array<{ id: string; term: string; createdAt: Date }>> {
  const entries = await ModerationBlocklistModel.find().sort({ createdAt: -1 });
  return entries.map((e) => ({ id: e._id.toString(), term: e.term, createdAt: e.createdAt }));
}

export async function addBlocklistTerm(term: string, addedBy: Types.ObjectId): Promise<{ id: string; term: string }> {
  const normalized = term.trim().toLowerCase();
  if (!normalized) {
    throw new ApiError(400, 'Term cannot be empty');
  }

  const existing = await ModerationBlocklistModel.findOne({ term: normalized });
  if (existing) {
    throw new ApiError(409, 'This term is already on the blocklist');
  }

  const entry = await ModerationBlocklistModel.create({ term: normalized, addedBy });
  return { id: entry._id.toString(), term: entry.term };
}

export async function removeBlocklistTerm(id: string): Promise<void> {
  const result = await ModerationBlocklistModel.findByIdAndDelete(id);
  if (!result) {
    throw new ApiError(404, 'Blocklist entry not found');
  }
}

export async function listModerationLogs(
  page: number,
  limit: number,
): Promise<{ items: IModerationLog[]; total: number }> {
  const [items, total] = await Promise.all([
    ModerationLogModel.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean<IModerationLog[]>(),
    ModerationLogModel.countDocuments(),
  ]);
  return { items, total };
}