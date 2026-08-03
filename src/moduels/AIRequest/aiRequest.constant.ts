import { AIService } from "../service-config/service-config.types.js";

// ─── Provider Gateway ─────────────────────────────────────────────────────────
// Base URLs for OpenAI-compatible providers.
// OpenAI itself uses the SDK default; only non-standard endpoints need explicit URLs.

export const PROVIDER_BASE_URLS: Record<string, string> = {
  GROK:     "https://api.x.ai/v1",
  DEEPSEEK: "https://api.deepseek.com/v1",
};

// ─── Provider Timeouts (ms) ───────────────────────────────────────────────────

export const PROVIDER_TIMEOUT_MS: Record<string, number> = {
  AI_CHAT:        60_000,
  PROMPT_GEN:     60_000,
  BUSINESS_IDEAS: 60_000,
  IMAGE_GEN:      90_000,
  ASSET_GEN:      90_000,
  EMBEDDING:      15_000,
};

export const DEFAULT_PROVIDER_TIMEOUT_MS = 60_000;

export const PING_MODELS: Record<string, string> = {
  openai:    "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-20241022",
  gemini:    "gemini-1.5-flash",
  grok:      "grok-2-latest",
  deepseek:  "deepseek-chat",
};

// ─── Token Estimation ─────────────────────────────────────────────────────────
// Used ONLY for pre-call cost estimation and the /estimate endpoint.
// Actual token cost is always reconciled from the provider's usage response.

export const CHARS_PER_TOKEN = 4;

// Estimated completion length as a fraction of total input tokens.
// Conservative (0.6) to avoid over-reserving tokens from the wallet.
export const COMPLETION_TOKEN_ESTIMATE_RATIO = 0.6;

// ─── Pagination ───────────────────────────────────────────────────────────────

export const AI_REQUEST_ALLOWED_SORT_FIELDS = [
  "createdAt",
  "tokenCost",
  "latencyMs",
] as const;

export const AI_REQUEST_DEFAULT_SORT_BY    = "createdAt";
export const AI_REQUEST_DEFAULT_SORT_ORDER = "desc" as const;

// ─── Redis Cache ──────────────────────────────────────────────────────────────

export const AI_REQUEST_CACHE_NAMESPACE = "ai_requests";
export const AI_REQUEST_CACHE_TTL       = 180; // 3 minutes

// ─── Token Source Labels ──────────────────────────────────────────────────────
// Used in TokenTransaction.source so the token ledger is self-describing.

export const TOKEN_SOURCE = {
  RESERVE:     "AI_REQUEST_RESERVE",
  RELEASE:     "AI_REQUEST_RELEASE",
  RECONCILE:   "AI_REQUEST_RECONCILE",
} as const;