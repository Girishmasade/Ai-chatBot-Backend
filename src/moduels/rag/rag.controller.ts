
import{ generateRagAnswer, type ChatCompletionFn } from '@/moduels/rag/rag.service.js';
import { ragQueryBodySchema } from '@/moduels/rag/rag.validation.js';
import type { AuthUser } from '../auth/auth.payload.js';
import { Types } from 'mongoose';
import { AsyncHandler } from '@/utils/AsyncHandler.js';
import { ApiError } from '@/utils/apiError.util.js';
import { successHandler } from '@/utils/successHandler.util.js';

const callChatProvider: ChatCompletionFn = async (_messages) => {
  throw new ApiError(409, "callChatProvider is not wired to a real AI provider yet")
};

export const ragQueryHandler = AsyncHandler(async (req, res) => {
  const body = ragQueryBodySchema.parse(req.body);

  const result = await generateRagAnswer({
    userId: new Types.ObjectId((req.user as AuthUser).id),
    userQuery: body.query,
    systemPrompt: body.systemPrompt,
    conversationHistory: body.conversationHistory,
    documentIds: body.documentIds,
    topK: body.topK,
    chatCompletionFn: callChatProvider,
  });

  return successHandler(res, 200, true, 'RAG response generated successfully', {
    answer: result.answer,
    sources: result.sources.map((s: any) => ({
      chunkId: s.chunkId,
      documentId: s.documentId,
      score: s.score,
      excerpt: s.content.slice(0, 200),
    })),
    provider: result.provider,
    meta: result.meta,
  });
});