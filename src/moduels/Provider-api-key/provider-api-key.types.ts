import { ProviderName } from "../Provider/provider-config.types.js";

/**
 *
 * Multiple ProviderNames can share the same AdapterType.
 *
 * Examples:
 *   OpenAI, ChatGPT, Grok, DeepSeek, Groq → OPENAI_COMPATIBLE
 *   Anthropic Claude                        → ANTHROPIC
 *   Google Gemini                           → GEMINI
 *   HuggingFace hosted models               → HUGGINGFACE
 *   Ollama self-hosted                      → OLLAMA
 *   Pollinations free API                   → POLLINATIONS
 *
 * The gateway picks the adapter from AdapterRegistry[adapterType]
 * NOT from the provider name — this is what makes it truly dynamic.
 */
export enum AdapterType {
  OPENAI_COMPATIBLE = "openai-compatible",
  ANTHROPIC = "anthropic",
  GEMINI = "gemini",
  HUGGINGFACE = "huggingface",
  OLLAMA = "ollama",
  POLLINATIONS = "pollinations",
}

/**
 * Maps each ProviderName to its default AdapterType.
 *
 * Used as a fallback when admin does not explicitly override
 * adapterType on the ProviderApiKey record.
 *
 * Admin can always override — for example, if a new provider
 * launches that is OpenAI-compatible, admin sets adapterType
 * to OPENAI_COMPATIBLE without any code change.
 */
export const DEFAULT_ADAPTER_MAP: Record<ProviderName, AdapterType> = {
  [ProviderName.OPENAI]: AdapterType.OPENAI_COMPATIBLE,
  [ProviderName.CHATGPT]: AdapterType.OPENAI_COMPATIBLE,
  [ProviderName.GROK]: AdapterType.OPENAI_COMPATIBLE,
  [ProviderName.DEEPSEEK]: AdapterType.OPENAI_COMPATIBLE,
  [ProviderName.GROQ]: AdapterType.OPENAI_COMPATIBLE,
  [ProviderName.ANTHROPIC]: AdapterType.ANTHROPIC,
  [ProviderName.GEMINI]: AdapterType.GEMINI,
  [ProviderName.HUGGINGFACE]: AdapterType.HUGGINGFACE,
  [ProviderName.POLLINATIONS]: AdapterType.POLLINATIONS,
};

/**
 * Providers that do not require an API key.
 * Gateway skips key presence validation for these.
 */
export const KEYLESS_PROVIDERS: ProviderName[] = [
  ProviderName.POLLINATIONS,
];

/**
 * Standard normalized response every adapter must return.
 * Gateway consumers (AIRequest pipeline) only ever see this shape —
 * never the raw provider response.
 */
export interface NormalizedAIResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  provider: ProviderName;
  model: string;
  adapterType: AdapterType;
  responseTimeMs: number;
  rawResponse: unknown; // stored in DB, never forwarded to client
}

/**
 * Payload injected into every adapter's execute() method.
 *
 * Adapters are pure functions — they never read from DB.
 * Everything they need is resolved and injected by the gateway.
 */
export interface AdapterPayload {
  apiKey: string | null; // null for keyless providers (Pollinations, Ollama)
  baseUrl: string | null; // null = use provider SDK default
  model: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  timeout: number;
  provider: ProviderName;
}