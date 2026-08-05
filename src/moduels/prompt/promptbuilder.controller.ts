import { AsyncHandler } from '@/utils/AsyncHandler.js';
import { successHandler } from '@/utils/successHandler.util.js';
import { buildPrompt } from '@/moduels/prompt/promptbuilder.service.js';
import { promptPreviewBodySchema, antiHallucinationPromptSchema } from '@/moduels/prompt/promptbuilder.validation.js';
import { buildAntiHallucinationPrompt } from '@/moduels/prompt/promptAntiHallucination.js';

export const previewPromptHandler = AsyncHandler(async (req, res) => {
  const body = promptPreviewBodySchema.parse(req.body);

  const built = buildPrompt({
    systemPrompt: body.systemPrompt,
    retrievedChunks: body.retrievedChunks,
    conversationHistory: body.conversationHistory,
    userQuery: body.userQuery,
  });

  return successHandler(res, 200, true, 'Prompt preview generated successfully', { data: built, status: true });
});

export const generateAntiHallucinationPromptHandler = AsyncHandler(async (req, res) => {
  const body = antiHallucinationPromptSchema.parse(req.body);

  const result = buildAntiHallucinationPrompt({
    prompt: body.prompt,
    options: {
      category: body.category,
      aspectRatio: body.aspectRatio,
      style: body.style,
      quality: body.quality,
      outputFormat: body.outputFormat,
      strictMode: body.strictMode,
    },
  });

  return successHandler(res, 200, true, 'Anti-hallucination prompt generated successfully', { data: result, status: true });
});