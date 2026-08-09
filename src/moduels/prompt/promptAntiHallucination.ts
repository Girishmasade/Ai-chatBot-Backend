/**
 * Prompt Anti-Hallucination & Enhancement Engine
 * 
 * Provides domain-specific system instructions, negative constraints, auto-category detection,
 * and structured prompt formatting for Image, Video, Business, and Digital Asset generation requests.
 * Eliminates model hallucinations, vague outputs, and fabricated data.
 */

export type PromptCategory = 'image' | 'video' | 'business' | 'asset' | 'general';

export interface AntiHallucinationOptions {
  category?: PromptCategory;
  aspectRatio?: string; // e.g. "16:9", "1:1", "9:16"
  style?: string;       // e.g. "photorealistic", "vector", "cinematic", "executive report"
  quality?: string;     // e.g. "8k", "masterpiece", "ultra-detailed"
  outputFormat?: string;// e.g. "json", "markdown", "png", "svg"
  strictMode?: boolean; // enforce extra anti-hallucination guardrails
}

export interface AntiHallucinationInput {
  prompt: string;
  options?: AntiHallucinationOptions;
  systemPromptOverride?: string;
}

export interface EnhancedPromptResult {
  category: PromptCategory;
  enhancedPrompt: string;
  systemPrompt: string;
  negativePrompt: string;
  guardrails: string[];
  parameters: Record<string, any>;
}

// ─── Domain Anti-Hallucination System Instructions ───────────────────────────

export const DOMAIN_SYSTEM_PROMPTS: Record<PromptCategory, string> = {
  image: `You are an elite, highly precise AI Image Prompt Specialist & Visual Engineer.
Your objective is to generate accurate, ultra-detailed image generation specifications.
STRICT ANTI-HALLUCINATION RULES FOR IMAGE GENERATION:
1. Do NOT hallucinate non-existent text overlays, random watermarks, or unrequested text inside the image.
2. Ensure anatomical accuracy: no extra limbs, mutated digits, or distorted facial features.
3. Keep physical lighting, shadows, and perspective consistent across the entire scene.
4. Specify clear camera parameters (lens size, depth of field, aperture, composition) rather than generic buzzwords.
5. If subject details are underspecified, make logical, realistic enhancements grounded in physics and photographic realism.`,

  video: `You are a professional AI Cinematographer & Zero-Hallucination Video Motion Specialist.
Your objective is to produce exact, photorealistic, and highly accurate video scene representations strictly aligned with the user's prompt.
STRICT ANTI-HALLUCINATION RULES FOR VIDEO GENERATION:
1. Do NOT hallucinate random objects, unrequested characters, text overlays, or unrelated background elements.
2. Deliver precise, high-fidelity visual depictions that strictly match the user's explicit subject matter.
3. Maintain flawless temporal consistency: subject appearance, colors, and lighting must remain completely stable without unnatural morphing.
4. Do NOT specify physically impossible camera movements or abrupt unnatural teleports.
5. Prevent motion warps, flickering artifacts, distortion, and physics-defying motion.`,

  business: `You are a Senior Strategic Business Advisor & Financial Analyst AI.
Your objective is to deliver factual, grounded, and actionable business strategies and asset proposals.
STRICT ANTI-HALLUCINATION RULES FOR BUSINESS GENERATION:
1. NEVER fabricate market statistics, customer quotes, revenue numbers, or fake benchmark reports.
2. Clearly distinguish between EMPIRICAL DATA, REASONABLE ASSUMPTIONS, and SPECULATIVE PROJECTIONS.
3. If specific financial figures or market data are unknown, explicitly state "Data unavailable / Needs market research" rather than inventing figures.
4. Provide structured, logical frameworks (e.g. SWOT, Unit Economics, Go-To-Market) with clear step-by-step reasoning.
5. Ensure all proposed revenue models adhere to realistic business standards and regulatory considerations.`,

  asset: `You are a Principal Digital Asset Designer & Technical Artist AI.
Your objective is to produce exact, production-ready specifications for digital, UI, 3D, and graphic assets.
STRICT ANTI-HALLUCINATION RULES FOR ASSET GENERATION:
1. Specify exact asset attributes: resolution, color palette (HEX/HSL), aspect ratio, background isolation (transparent PNG / SVG vector).
2. Avoid generic descriptors; define clean geometry, border radius, lighting style, and export format explicitly.
3. Do NOT include unrequested text, signatures, or decorative clutter in visual asset prompts.
4. Ensure asset scalability, modular design principles, and strict adherence to modern design systems.
5. Ensure 3D assets describe topology, texture materials (PBR), and lighting setup accurately without impossible geometry.`,

  general: `You are a High-Precision, Zero-Hallucination AI Assistant.
Your objective is to provide truthful, precise, and verified responses.
STRICT ANTI-HALLUCINATION RULES:
1. Answer strictly based on verified facts and provided context.
2. If you do not know the answer or if context is missing, explicitly state "I do not have enough information" rather than guessing.
3. Do NOT invent references, citations, APIs, model numbers, or historical events.
4. Structure your response clearly using headers, bullet points, or JSON formats as requested.`
};

// ─── Domain Negative Prompts (What NOT to generate) ───────────────────────────

export const DOMAIN_NEGATIVE_PROMPTS: Record<PromptCategory, string> = {
  image: "text overlay, watermark, signature, blurry, low resolution, extra fingers, mutated hands, distorted eyes, bad anatomy, overexposed, underexposed, ugly, duplicate elements, out of frame, cropped",
  video: "motion blur artifacts, sudden morphing, flickering background, camera jitter, warped physics, floating objects, frame drops, low frame rate, inconsistent lighting, distorted faces",
  business: "fabricated statistics, fake customer reviews, unverified revenue claims, buzzword salad, unrealistic 1000x growth guarantees, illegal practices, ambiguous statements, missing risk disclosures",
  asset: "noisy background, non-isolated assets, low contrast, corrupted vectors, unintended text, misaligned borders, broken geometry, blurry textures, compression artifacts",
  general: "ungrounded claims, fabricated facts, fake quotes, hallucinated sources, self-contradictory logic, vague generalizations"
};

// ─── Auto-Category Detection ─────────────────────────────────────────────────

export function detectPromptCategory(prompt: string): PromptCategory {
  const lower = prompt.toLowerCase();

  // Video keywords (check video first to avoid misclassifying video prompts as image)
  if (
    /video|animation|clip|cinematic motion|camera movement|timelapse|slow motion|runway|sora|pika|luma|hunyuan/i.test(lower)
  ) {
    return 'video';
  }

  // Image keywords
  if (
    /draw|picture|photo|photograph|image|illustration|painting|render|portrait|landscape|dall-e|midjourney|stable diffusion|flux/i.test(lower)
  ) {
    return 'image';
  }

  // Business keywords
  if (
    /business|startup|monetization|revenue|market analysis|competitor|pitch deck|strategy|financial model|swot|go-to-market|marketing strategy|business plan/i.test(lower)
  ) {
    return 'business';
  }

  // Asset keywords
  if (
    /asset|icon|logo|ui component|vector|3d model|sprite|texture|graphic asset|badge|button design|design system/i.test(lower)
  ) {
    return 'asset';
  }

  return 'general';
}

// ─── Domain Prompt Enhancers ──────────────────────────────────────────────────

function enhanceImagePrompt(rawPrompt: string, options?: AntiHallucinationOptions): string {
  const style = options?.style || 'high-resolution photorealistic detail';
  const quality = options?.quality || '8k resolution, crisp focus, cinematic lighting';
  const aspectRatio = options?.aspectRatio ? `[Aspect Ratio: ${options.aspectRatio}]` : '[Aspect Ratio: 16:9]';

  return `[IMAGE GENERATION PROMPT]
Subject & Composition: ${rawPrompt.trim()}
Visual Style: ${style}
Lighting & Atmosphere: Natural balanced lighting, volumetric atmosphere, rich contrast
Technical Specs: ${quality}, color-graded, sharp focus, professional composition
Parameters: ${aspectRatio}
Anti-Hallucination Directives: Sharp anatomy, zero text artifacts, clean background separation, realistic physics.`;
}

function enhanceVideoPrompt(rawPrompt: string, options?: AntiHallucinationOptions): string {
  const style = options?.style || 'cinematic 4k motion';
  const aspectRatio = options?.aspectRatio ? `[Aspect Ratio: ${options.aspectRatio}]` : '[Aspect Ratio: 16:9]';

  return `[VIDEO GENERATION PROMPT]
Scene Action: ${rawPrompt.trim()}
Camera Movement: Smooth tracking shot, natural depth-of-field transition, stable lens motion
Style & Aesthetic: ${style}, 60fps fluid motion, professional color grading
Lighting Dynamics: Consistent key lighting, soft fill light, consistent environmental reflections
Parameters: ${aspectRatio}, [Duration: 5-10s]
Anti-Hallucination Directives: Zero motion warping, consistent character keyframes, smooth physics-based movement.`;
}

function enhanceBusinessPrompt(rawPrompt: string, options?: AntiHallucinationOptions): string {
  const format = options?.outputFormat || 'Structured Executive Markdown';

  return `[BUSINESS STRATEGY GENERATION PROMPT]
Core Query / Business Scope: ${rawPrompt.trim()}
Required Output Structure:
1. Executive Summary & Objective
2. Market Opportunities & Grounded Insights
3. Monetization Framework & Unit Economics
4. Strategic Action Plan (Phase 1 to Phase 3)
5. Risk Assessment & Key Constraints
Output Format: ${format}
Anti-Hallucination Directives: Rely ONLY on verifiable market logic. Mark all projections as estimates. Do NOT invent stats or quote fake reports.`;
}

function enhanceAssetPrompt(rawPrompt: string, options?: AntiHallucinationOptions): string {
  const style = options?.style || 'Clean modern digital asset';
  const format = options?.outputFormat || 'PNG (Transparent Background) / Vector SVG';

  return `[DIGITAL ASSET GENERATION PROMPT]
Asset Specification: ${rawPrompt.trim()}
Visual Style: ${style}
Design Tokens: Clean geometry, harmonious color palette, high contrast, modern design guidelines
Background: Isolated transparent background
Target Format: ${format}
Anti-Hallucination Directives: No extraneous decorations, crisp edges, zero unwanted text, perfect alignment.`;
}

function enhanceGeneralPrompt(rawPrompt: string, options?: AntiHallucinationOptions): string {
  return `[ACCURATE & STRUCTURED QUERY PROMPT]
User Query: ${rawPrompt.trim()}
Task Directive: Provide a clear, precise, step-by-step response.
Anti-Hallucination Directives: State known facts clearly. Explicitly flag any uncertainties. Do NOT fabricate information.`;
}

// ─── Main Anti-Hallucination Builder Function ─────────────────────────────────

export function buildAntiHallucinationPrompt(input: AntiHallucinationInput): EnhancedPromptResult {
  const { prompt, options, systemPromptOverride } = input;

  // 1. Resolve Category
  const category = options?.category || detectPromptCategory(prompt);

  // 2. Resolve System Prompt
  const systemPrompt = systemPromptOverride || DOMAIN_SYSTEM_PROMPTS[category];

  // 3. Resolve Negative Prompt
  const negativePrompt = DOMAIN_NEGATIVE_PROMPTS[category];

  // 4. Build Category-Enhanced Prompt
  let enhancedPrompt = '';
  switch (category) {
    case 'image':
      enhancedPrompt = enhanceImagePrompt(prompt, options);
      break;
    case 'video':
      enhancedPrompt = enhanceVideoPrompt(prompt, options);
      break;
    case 'business':
      enhancedPrompt = enhanceBusinessPrompt(prompt, options);
      break;
    case 'asset':
      enhancedPrompt = enhanceAssetPrompt(prompt, options);
      break;
    case 'general':
    default:
      enhancedPrompt = enhanceGeneralPrompt(prompt, options);
      break;
  }

  // 5. Build Guardrails List
  const guardrails = [
    `Category: ${category.toUpperCase()}`,
    'Zero-hallucination enforcement active',
    'Strict structural formatting applied',
    'Negative prompt constraints attached',
    options?.strictMode ? 'Strict anti-speculation mode enabled' : 'Standard factual mode enabled'
  ];

  return {
    category,
    enhancedPrompt,
    systemPrompt,
    negativePrompt,
    guardrails,
    parameters: {
      aspectRatio: options?.aspectRatio || '16:9',
      style: options?.style || 'default',
      quality: options?.quality || 'high',
      outputFormat: options?.outputFormat || 'default',
      strictMode: options?.strictMode ?? true,
    }
  };
}

/**
 * Service map helper to easily enhance AIRequest service payloads
 */
export function mapAIServiceToCategory(service: string): PromptCategory {
  switch (service) {
    case 'image_gen':
      return 'image';
    case 'video_gen':
      return 'video';
    case 'business_ideas':
      return 'business';
    case 'asset_gen':
      return 'asset';
    default:
      return 'general';
  }
}
