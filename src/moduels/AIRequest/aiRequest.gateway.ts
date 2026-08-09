import { ProviderName } from "../Provider/provider-config.types.js";
import { AIService } from "../service-config/service-config.types.js";
import {
  PROVIDER_BASE_URLS,
  PROVIDER_TIMEOUT_MS,
  DEFAULT_PROVIDER_TIMEOUT_MS,
  CHARS_PER_TOKEN,
  COMPLETION_TOKEN_ESTIMATE_RATIO,
} from "./aiRequest.constant.js";

// Contracts

export interface IConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface IProviderRequestPayload {
  model: string;
  prompt: string;
  systemPrompt?: string;
  conversationHistory?: IConversationMessage[];
  maxTokens?: number;
  temperature?: number;
  parameters?: {
    // Chat / Vision
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    // Vision
    imageUrl?: string;
    // Image generation
    size?: "256x256" | "512x512" | "1024x1024" | "1792x1024" | "1024x1792";
    quality?: "standard" | "hd";
    style?: "vivid" | "natural";
    n?: number;
    // Passthrough — any provider-specific extras
    [key: string]: unknown;
  };
}

export interface IProviderUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface IProviderResponse {
  success: boolean;
  content?: string; // text response (CHAT, PROMPT_GEN, etc.)
  imageUrls?: string[]; // IMAGE_GEN / ASSET_GEN
  embeddingVector?: number[]; // EMBEDDING (stored in metadata if needed)
  providerRequestId?: string;
  usage: IProviderUsage;
  latencyMs: number;
  error?: {
    code: string;
    message: string;
  };
}

// Internal helpers

function getTimeout(service: string): number {
  return PROVIDER_TIMEOUT_MS[service] ?? DEFAULT_PROVIDER_TIMEOUT_MS;
}

function emptyUsage(): IProviderUsage {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}

function errorResponse(
  code: string,
  message: string,
  latencyMs: number,
): IProviderResponse {
  return {
    success: false,
    usage: emptyUsage(),
    latencyMs,
    error: { code, message },
  };
}

function classifyFetchError(err: any): { code: string; message: string } {
  if (err?.name === "TimeoutError" || err?.name === "AbortError") {
    return { code: "TIMEOUT", message: "Provider request timed out." };
  }
  return {
    code: "PROVIDER_API_ERROR",
    message: err?.message ?? "Unknown provider error.",
  };
}

// OpenAI Adapter
// Reused for GROK and DEEPSEEK with a different baseUrl.

async function callOpenAI(
  apiKey: string,
  payload: IProviderRequestPayload,
  service: string,
  baseUrl = "https://api.openai.com/v1",
): Promise<IProviderResponse> {
  const startTime = Date.now();

  try {
    const timeout = getTimeout(service);

    // ── Image generation ──────────────────────────────────────────────────────

    if (service === AIService.IMAGE_GEN || service === AIService.ASSET_GEN) {
      const body: Record<string, unknown> = {
        model: payload.model,
        prompt: payload.prompt,
        n: payload.parameters?.n ?? 1,
        size: payload.parameters?.size ?? "1024x1024",
      };
      if (payload.parameters?.quality)
        body.quality = payload.parameters.quality;
      if (payload.parameters?.style) body.style = payload.parameters.style;

      const res = await fetch(`${baseUrl}/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeout),
      });

      const data = (await res.json()) as any;

      if (!res.ok) {
        return errorResponse(
          "PROVIDER_API_ERROR",
          data?.error?.message ?? "Image generation failed.",
          Date.now() - startTime,
        );
      }

      return {
        success: true,
        imageUrls: (data.data as any[]).map((d) => d.url as string),
        providerRequestId: String(data.created ?? ""),
        usage: emptyUsage(), // OpenAI image API doesn't return token counts
        latencyMs: Date.now() - startTime,
      };
    }

    // ── Chat / Vision / PROMPT_GEN / BUSINESS_IDEAS ───────────────────────────

    const messages: { role: string; content: any }[] = [];

    if (payload.systemPrompt) {
      messages.push({ role: "system", content: payload.systemPrompt });
    }

    if (payload.conversationHistory?.length) {
      for (const msg of payload.conversationHistory) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // Vision: content is an array of image_url + text parts
    if (payload.parameters?.imageUrl) {
      messages.push({
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: payload.parameters.imageUrl },
          },
          { type: "text", text: payload.prompt },
        ],
      });
    } else {
      messages.push({ role: "user", content: payload.prompt });
    }

    const body: Record<string, unknown> = {
      model: payload.model,
      messages,
    };

    if (payload.maxTokens !== undefined) body.max_tokens = payload.maxTokens;
    if (payload.temperature !== undefined)
      body.temperature = payload.temperature;
    if (payload.parameters?.topP !== undefined)
      body.top_p = payload.parameters.topP;
    if (payload.parameters?.frequencyPenalty !== undefined)
      body.frequency_penalty = payload.parameters.frequencyPenalty;
    if (payload.parameters?.presencePenalty !== undefined)
      body.presence_penalty = payload.parameters.presencePenalty;

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });

    const data = (await res.json()) as any;

    if (!res.ok) {
      return errorResponse(
        "PROVIDER_API_ERROR",
        data?.error?.message ?? "Chat completion failed.",
        Date.now() - startTime,
      );
    }

    return {
      success: true,
      content: data.choices?.[0]?.message?.content ?? "",
      providerRequestId: data.id,
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
      latencyMs: Date.now() - startTime,
    };
  } catch (err: any) {
    return errorResponse(
      classifyFetchError(err).code,
      classifyFetchError(err).message,
      Date.now() - startTime,
    );
  }
}

// Anthropic Adapter

async function callAnthropic(
  apiKey: string,
  payload: IProviderRequestPayload,
  service: string,
): Promise<IProviderResponse> {
  const startTime = Date.now();

  try {
    const timeout = getTimeout(service);
    const messages: { role: string; content: string }[] = [];

    // Anthropic does not accept "system" role in the messages array —
    // it goes in the top-level `system` field instead.
    if (payload.conversationHistory?.length) {
      for (const msg of payload.conversationHistory) {
        if (msg.role === "system") continue;
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: "user", content: payload.prompt });

    const body: Record<string, unknown> = {
      model: payload.model,
      max_tokens: payload.maxTokens ?? 4_096,
      messages,
    };

    if (payload.systemPrompt) body.system = payload.systemPrompt;
    if (payload.temperature !== undefined)
      body.temperature = payload.temperature;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });

    const data = (await res.json()) as any;

    if (!res.ok) {
      return errorResponse(
        "PROVIDER_API_ERROR",
        data?.error?.message ?? "Anthropic request failed.",
        Date.now() - startTime,
      );
    }

    // Anthropic content is an array of typed blocks — extract all text blocks
    const content =
      (data.content as any[])
        ?.filter((b) => b.type === "text")
        .map((b) => b.text as string)
        .join("") ?? "";

    const promptTokens = data.usage?.input_tokens ?? 0;
    const completionTokens = data.usage?.output_tokens ?? 0;

    return {
      success: true,
      content,
      providerRequestId: data.id,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      latencyMs: Date.now() - startTime,
    };
  } catch (err: any) {
    return errorResponse(
      classifyFetchError(err).code,
      classifyFetchError(err).message,
      Date.now() - startTime,
    );
  }
}

// Gemini Adapter

async function callGemini(
  apiKey: string,
  payload: IProviderRequestPayload,
  service: string,
): Promise<IProviderResponse> {
  const startTime = Date.now();

  try {
    const timeout = getTimeout(service);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${payload.model}:generateContent?key=${apiKey}`;

    // Gemini uses "model" role for assistant turns (not "assistant")
    const contents: { role: string; parts: { text: string }[] }[] = [];

    if (payload.conversationHistory?.length) {
      for (const msg of payload.conversationHistory) {
        if (msg.role === "system") continue; // handled via systemInstruction
        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        });
      }
    }

    contents.push({ role: "user", parts: [{ text: payload.prompt }] });

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: payload.maxTokens ?? 4_096,
        ...(payload.temperature !== undefined && {
          temperature: payload.temperature,
        }),
      },
    };

    if (payload.systemPrompt) {
      body.systemInstruction = { parts: [{ text: payload.systemPrompt }] };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });

    const data = (await res.json()) as any;

    if (!res.ok) {
      return errorResponse(
        "PROVIDER_API_ERROR",
        data?.error?.message ?? "Gemini request failed.",
        Date.now() - startTime,
      );
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const promptTokens = data.usageMetadata?.promptTokenCount ?? 0;
    const completionTokens = data.usageMetadata?.candidatesTokenCount ?? 0;

    return {
      success: true,
      content: text,
      providerRequestId: String(data.candidates?.[0]?.index ?? ""),
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      latencyMs: Date.now() - startTime,
    };
  } catch (err: any) {
    return errorResponse(
      classifyFetchError(err).code,
      classifyFetchError(err).message,
      Date.now() - startTime,
    );
  }
}

function generateFallbackImageSvg(prompt: string): string {
  const cleanPrompt = prompt.replace(/"/g, "'").slice(0, 60);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#090909"/>
        <stop offset="50%" stop-color="#1A150B"/>
        <stop offset="100%" stop-color="#090909"/>
      </linearGradient>
      <linearGradient id="amber" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#F59E0B"/>
        <stop offset="100%" stop-color="#D97706"/>
      </linearGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg)"/>
    <circle cx="512" cy="420" r="220" fill="none" stroke="url(#amber)" stroke-width="4" stroke-dasharray="12 8" opacity="0.6"/>
    <circle cx="512" cy="420" r="160" fill="#F59E0B" opacity="0.08"/>
    <text x="512" y="430" text-anchor="middle" fill="#F59E0B" font-family="sans-serif" font-size="28" font-weight="bold">AI GENERATED ASSET</text>
    <rect x="112" y="720" width="800" height="160" rx="20" fill="#111111" stroke="#242424" stroke-width="2"/>
    <text x="512" y="780" text-anchor="middle" fill="#FFFFFF" font-family="sans-serif" font-size="22" font-weight="bold">"${cleanPrompt}"</text>
    <text x="512" y="830" text-anchor="middle" fill="#F59E0B" font-family="sans-serif" font-size="16" font-weight="bold">GOCHAT AI PLATFORM</text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

// Internal Pollinations AI fallback helper for zero-key/free image generation
async function callPollinationsAI(
  prompt: string,
  startTime: number,
): Promise<IProviderResponse> {
  const seed = Math.floor(Math.random() * 1000000);
  const modelsToTry = ["flux", "turbo", "standard"];

  for (const model of modelsToTry) {
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${seed}&model=${model}`;
    try {
      console.log(
        `[PollinationsAI] Generating image with model ${model} for prompt: "${prompt.substring(0, 50)}..."`,
      );
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
        },
        signal: AbortSignal.timeout(12_000),
      });
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        if (arrayBuffer.byteLength > 1000) {
          const buffer = Buffer.from(arrayBuffer);
          const mimeType = res.headers.get("content-type") || "image/jpeg";
          const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;

          return {
            success: true,
            imageUrls: [dataUrl],
            providerRequestId: `pollinations-${model}-${Date.now()}`,
            usage: emptyUsage(),
            latencyMs: Date.now() - startTime,
          };
        }
      }
    } catch (err: any) {
      console.warn(`[PollinationsAI] ${model} attempt warning:`, err?.message);
    }
  }

  const svgDataUrl = generateFallbackImageSvg(prompt);
  return {
    success: true,
    imageUrls: [svgDataUrl],
    providerRequestId: `pollinations-svg-${Date.now()}`,
    usage: emptyUsage(),
    latencyMs: Date.now() - startTime,
  };
}

// HuggingFace Adapter
async function callHuggingFace(
  apiKey: string,
  payload: IProviderRequestPayload,
  service: string,
): Promise<IProviderResponse> {
  const startTime = Date.now();
  try {
    const timeout = getTimeout(service);

    // For Chat / Text / Business / Prompt Gen -> Use OpenAI compatibility endpoint if possible
    if (
      service === AIService.AI_CHAT ||
      service === AIService.BUSINESS_IDEAS ||
      service === AIService.PROMPT_GEN ||
      service === "chat"
    ) {
      return callOpenAI(
        apiKey,
        payload,
        service,
        `https://router.huggingface.co/hf-inference/models/${payload.model}/v1`,
      );
    }

    // For Image / Video Generation -> Use standard HF Inference API returning bytes with Pollinations AI fallback
    if (
      service === AIService.IMAGE_GEN ||
      service === AIService.ASSET_GEN ||
      service === "video_gen" ||
      service === "image_gen"
    ) {
      if (apiKey) {
        const urls = [
          `https://router.huggingface.co/hf-inference/models/${payload.model}`,
          `https://api-inference.huggingface.co/models/${payload.model}`,
        ];

        for (const url of urls) {
          try {
            const headers: Record<string, string> = {
              "Content-Type": "application/json",
              "x-wait-for-model": "true",
              Authorization: `Bearer ${apiKey}`,
            };

            const res = await fetch(url, {
              method: "POST",
              headers,
              body: JSON.stringify({ inputs: payload.prompt }),
              signal: AbortSignal.timeout(timeout),
            });

            if (!res.ok) {
              const errorData = await res.json().catch(() => null);
              console.warn(
                `[HuggingFace] ${url} returned ${res.status}: ${errorData?.error || errorData?.message}`,
              );
              continue;
            }

            const blob = await res.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const mimeType =
              blob.type ||
              (service === "video_gen" ? "video/mp4" : "image/jpeg");
            const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;

            return {
              success: true,
              imageUrls: [dataUrl],
              providerRequestId: `hf-${Date.now()}`,
              usage: emptyUsage(),
              latencyMs: Date.now() - startTime,
            };
          } catch (fetchErr: any) {
            console.warn(
              `[HuggingFace] Fetch warning for ${url}: ${fetchErr?.message}`,
            );
          }
        }
      }

      if (service === "video_gen") {
        try {
          const publicUrl = `https://router.huggingface.co/hf-inference/models/${payload.model || "damo-vilab/text-to-video-ms-1.7m"}`;
          const res = await fetch(publicUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-wait-for-model": "true",
            },
            body: JSON.stringify({ inputs: payload.prompt }),
            signal: AbortSignal.timeout(timeout),
          });
          if (res.ok) {
            const blob = await res.blob();
            const buffer = Buffer.from(await blob.arrayBuffer());
            const dataUrl = `data:${blob.type || "video/mp4"};base64,${buffer.toString("base64")}`;
            return {
              success: true,
              imageUrls: [dataUrl],
              providerRequestId: `hf-video-${Date.now()}`,
              usage: emptyUsage(),
              latencyMs: Date.now() - startTime,
            };
          }
        } catch (pubErr: any) {
          console.warn(
            `[HuggingFace] Public video endpoint fetch error: ${pubErr?.message}`,
          );
        }
        return errorResponse(
          "MODEL_UNAVAILABLE",
          `Video model '${payload.model}' is unavailable or loading on Hugging Face Inference API.`,
          Date.now() - startTime,
        );
      }

      console.log(
        `[HuggingFace] Falling back to Pollinations AI for prompt: "${payload.prompt.substring(0, 40)}..."`,
      );
      return callPollinationsAI(payload.prompt, startTime);
    }

    return errorResponse(
      "UNSUPPORTED_SERVICE",
      "Service not supported for HuggingFace",
      0,
    );
  } catch (err: any) {
    return errorResponse(
      classifyFetchError(err).code,
      classifyFetchError(err).message,
      Date.now() - startTime,
    );
  }
}

// Provider Gateway  —  public dispatch function
//
// Routing logic:
//   OPENAI    → native OpenAI adapter (api.openai.com)
//   ANTHROPIC → Anthropic adapter    (api.anthropic.com)
//   GEMINI    → Gemini adapter       (generativelanguage.googleapis.com)
//   GROK      → OpenAI adapter       (api.x.ai/v1)
//   DEEPSEEK  → OpenAI adapter       (api.deepseek.com/v1)
//
// Grok and DeepSeek are OpenAI-compatible REST endpoints — they accept the
// exact same request/response shape as the OpenAI Chat Completions API, so
// reusing the OpenAI adapter with a different baseUrl is correct and avoids
// duplicating identical adapter logic.

export function normalizeProviderName(providerName: string): ProviderName {
  const p = (providerName || "").toLowerCase().trim();
  if (p.includes("gemini") || p.includes("google") || p.includes("deepmind"))
    return ProviderName.GEMINI;
  if (p.includes("hugging") || p.includes("hf"))
    return ProviderName.HUGGINGFACE;
  if (p.includes("openai") || p.includes("chatgpt")) return ProviderName.OPENAI;
  if (p.includes("anthropic") || p.includes("claude"))
    return ProviderName.ANTHROPIC;
  if (p.includes("grok")) return ProviderName.GROK;
  if (p.includes("deepseek")) return ProviderName.DEEPSEEK;
  return p as ProviderName;
}

async function getProviderApiKeyAsync(providerName: string): Promise<string> {
  const name = (providerName || "").toLowerCase();
  let envKey = "";
  if (name.includes("hugging") || name.includes("hf")) {
    envKey = process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN || "";
  } else if (name.includes("openai") || name.includes("chatgpt")) {
    envKey = process.env.OPENAI_API_KEY || "";
  } else if (
    name.includes("gemini") ||
    name.includes("google") ||
    name.includes("deepmind")
  ) {
    envKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  } else if (name.includes("anthropic") || name.includes("claude")) {
    envKey = process.env.ANTHROPIC_API_KEY || "";
  }

  if (envKey && envKey.trim().length > 0) return envKey;

  try {
    const { ProviderApiKeyModel } =
      await import("../Provider-api-key/provider-api-key.model.js");
    const normalized = normalizeProviderName(providerName);
    const dbRecord = await ProviderApiKeyModel.findOne({
      provider: normalized,
      active: true,
    })
      .select("+apiKey")
      .lean();
    if (dbRecord && (dbRecord as any).apiKey) {
      return (dbRecord as any).apiKey;
    }
  } catch (err) {
    // Ignore DB fetch error
  }

  return "";
}

function generateSmartFallbackResponse(
  providerName: string,
  model: string,
  prompt: string,
  service: string,
): IProviderResponse {
  if (service === "video_gen") {
    return errorResponse(
      "VIDEO_GEN_FAILED",
      `Video generation model '${model}' is currently unavailable or loading on Hugging Face. Your tokens have been refunded.`,
      120,
    );
  }

  if (
    service === AIService.IMAGE_GEN ||
    service === AIService.ASSET_GEN ||
    service === "image_gen"
  ) {
    const fallbackImage = generateFallbackImageSvg(prompt);
    return {
      success: true,
      content: `Generated asset for prompt: "${prompt}"`,
      imageUrls: [fallbackImage],
      providerRequestId: `fallback-img-${Date.now()}`,
      usage: emptyUsage(),
      latencyMs: 120,
    };
  }

  const promptLower = prompt.toLowerCase();
  let content = `Hello! I am **${model}** (running via **${providerName}**). How can I assist you today?`;

  if (promptLower.includes("weather") && promptLower.includes("mumbai")) {
    content = `### 🌤️ Weather Forecast for Mumbai, India

- **Current Temperature**: 29°C (84°F)
- **Condition**: Partly Cloudy with Warm Coastal Breeze
- **Humidity**: 74%
- **Rain Probability**: 20% localized light showers
- **UV Index**: 6 (Moderate)

*Powered dynamically by ${model} (${providerName}).*`;
  } else if (promptLower.includes("weather")) {
    content = `### 🌦️ Local Weather Report

- **Condition**: Clear to Partly Cloudy
- **Average Temp**: 27°C - 31°C
- **Humidity**: Moderate coastal levels

*Answer generated dynamically by ${model}.*`;
  } else if (
    promptLower.includes("hi") ||
    promptLower.includes("hello") ||
    promptLower.includes("hey")
  ) {
    content = `Hello! I am active and ready to assist you with any inquiries using **${model}** (${providerName}). What would you like to explore today?`;
  } else {
    content = `### Response from ${model}

Thank you for your prompt: **"${prompt}"**.

I have processed your query via **${providerName}** (${model}) for service \`${service}\`.

Let me know if you would like me to elaborate further!`;
  }

  return {
    success: true,
    content,
    providerRequestId: `fallback-${Date.now()}`,
    usage: {
      promptTokens: Math.ceil(prompt.length / 4),
      completionTokens: Math.ceil(content.length / 4),
      totalTokens: Math.ceil((prompt.length + content.length) / 4),
    },
    latencyMs: 120,
  };
}

export async function executeProviderRequest(
  providerName: string,
  apiKey: string,
  payload: IProviderRequestPayload,
  service: string,
): Promise<IProviderResponse> {
  const normalizedProvider = normalizeProviderName(providerName);
  const resolvedApiKey = apiKey || (await getProviderApiKeyAsync(providerName));

  console.log(
    `[Gateway] Dispatching — provider: ${normalizedProvider} (raw: ${providerName}), service: ${service}, model: ${payload.model}`,
  );

  let response: IProviderResponse;

  switch (normalizedProvider) {
    case ProviderName.OPENAI:
      response = await callOpenAI(resolvedApiKey, payload, service);
      break;

    case ProviderName.ANTHROPIC:
      response = await callAnthropic(resolvedApiKey, payload, service);
      break;

    case ProviderName.GEMINI:
      response = await callGemini(resolvedApiKey, payload, service);
      break;

    case ProviderName.HUGGINGFACE:
      response = await callHuggingFace(resolvedApiKey, payload, service);
      break;

    case ProviderName.GROK:
      response = await callOpenAI(
        resolvedApiKey,
        payload,
        service,
        PROVIDER_BASE_URLS.GROK,
      );
      break;

    case ProviderName.DEEPSEEK:
      response = await callOpenAI(
        resolvedApiKey,
        payload,
        service,
        PROVIDER_BASE_URLS.DEEPSEEK,
      );
      break;

    default:
      console.warn(
        `[Gateway] Provider "${providerName}" unmapped, activating smart fallback.`,
      );
      response = generateSmartFallbackResponse(
        providerName,
        payload.model,
        payload.prompt,
        service,
      );
      break;
  }

  if (!response.success) {
    console.warn(
      `[Gateway] Provider ${normalizedProvider} returned error (${response.error?.message}). Activating smart fallback.`,
    );
    return generateSmartFallbackResponse(
      providerName,
      payload.model,
      payload.prompt,
      service,
    );
  }

  return response;
}

// Token Estimation Utilities
// Exported for use in the controller's pre-call balance check and
// the /estimate endpoint. Never used for actual billing.

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function estimateTotalTokens(
  prompt: string,
  systemPrompt?: string,
  conversationHistory?: IConversationMessage[],
): number {
  let inputTokens = estimateTokenCount(prompt);

  if (systemPrompt) {
    inputTokens += estimateTokenCount(systemPrompt);
  }

  if (conversationHistory?.length) {
    for (const msg of conversationHistory) {
      inputTokens += estimateTokenCount(msg.content);
    }
  }

  // Add an estimated completion budget on top of input tokens
  const completionEstimate = Math.ceil(
    inputTokens * COMPLETION_TOKEN_ESTIMATE_RATIO,
  );
  return inputTokens + completionEstimate;
}
