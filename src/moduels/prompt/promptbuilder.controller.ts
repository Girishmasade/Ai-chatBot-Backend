import { AsyncHandler } from '@/utils/AsyncHandler.js';
import { successHandler } from '@/utils/successHandler.util.js';
import { buildPrompt } from '@/moduels/prompt/promptbuilder.service.js';
import { promptPreviewBodySchema } from '@/moduels/prompt/promptbuilder.validation.js';
 

export const previewPromptHandler = AsyncHandler(async (req, res) => {
  const body = promptPreviewBodySchema.parse(req.body);
 
  const built = buildPrompt({
    systemPrompt: body.systemPrompt,
    retrievedChunks: body.retrievedChunks,
    conversationHistory: body.conversationHistory,
    userQuery: body.userQuery,
  });
 
  return successHandler(res, 200, true, 'Prompt preview generated successfully', { data: built, status: true});
});