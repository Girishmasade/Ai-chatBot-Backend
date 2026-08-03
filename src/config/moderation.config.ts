import { ModerationCategory } from "@/moduels/moderation/moderation.type.js";

export const BLOCKED_CATEGORIES: ModerationCategory[] = [
  ModerationCategory.SEXUAL,
  ModerationCategory.SEXUAL_MINORS,
  ModerationCategory.HATE,
  ModerationCategory.HATE_THREATENING,
  ModerationCategory.HARASSMENT_THREATENING,
  ModerationCategory.SELF_HARM_INTENT,
  ModerationCategory.SELF_HARM_INSTRUCTIONS,
  ModerationCategory.VIOLENCE_GRAPHIC,
];
 
export const MODERATION_BLOCKED_MESSAGE =
  'Your message could not be processed because it appears to violate our content policy. Please rephrase your request.';
 
export const HF_MODERATION_MODELS = {
  // Multi-label: toxic, severe_toxic, obscene, threat, insult, identity_hate
  toxicity: 'unitary/toxic-bert',
  // Binary: NSFW vs SFW
  nsfw: 'eliasalbouzidi/distilbert-nsfw-text-classifier',
} as const;
 
export const MODERATION_SCORE_THRESHOLD = 0.5;
 
export const MODERATION_MAX_RETRIES = 3;
export const MODERATION_RETRY_BASE_DELAY_MS = 500;
 
 

export const CATEGORY_MODEL_MAP: Partial<Record<ModerationCategory, { model: keyof typeof HF_MODERATION_MODELS; label: string }>> = {
  [ModerationCategory.SEXUAL]: { model: 'nsfw', label: 'NSFW' },
  [ModerationCategory.HATE]: { model: 'toxicity', label: 'identity_hate' },
  [ModerationCategory.HATE_THREATENING]: { model: 'toxicity', label: 'identity_hate' },
  [ModerationCategory.HARASSMENT]: { model: 'toxicity', label: 'insult' },
  [ModerationCategory.HARASSMENT_THREATENING]: { model: 'toxicity', label: 'threat' },
  [ModerationCategory.VIOLENCE]: { model: 'toxicity', label: 'threat' },
  [ModerationCategory.VIOLENCE_GRAPHIC]: { model: 'toxicity', label: 'threat' },
  // SEXUAL_MINORS, SELF_HARM, SELF_HARM_INTENT, SELF_HARM_INSTRUCTIONS:
  // deliberately absent — see warning above.
};
 
export const HF_INFERENCE_API_BASE = 'https://api-inference.huggingface.co/models';
 