import { Types } from 'mongoose';
import { retrieveRelevantChunks } from '@/moduels/retrieval/retrieval.service .js';
import { buildPrompt } from '@/moduels/prompt/promptbuilder.service.js';
import type{ ConversationTurn, BuiltPrompt } from '@/moduels/prompt/promptbuilder.types.js';
import type{ RetrievedChunk } from '@/moduels/retrieval/retrieval.type.js';

const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful assistant that answers questions using the provided context when relevant.';

export type ChatCompletionFn = (
  messages: BuiltPrompt['messages'],
) => Promise<{ content: string; provider?: string }>;

export interface GenerateRagAnswerParams {
  userId: Types.ObjectId;
  userQuery: string;
  systemPrompt?: string;
  conversationHistory?: ConversationTurn[];
  documentIds?: string[];
  topK?: number;
  chatCompletionFn: ChatCompletionFn;
}

export interface GenerateRagAnswerResult {
  answer: string;
  sources: RetrievedChunk[];
  provider?: string;
  meta: {
    chunksRetrieved: number;
    chunksUsedInPrompt: number;
    contextUsedChars: number;
  };
}

export async function generateRagAnswer(params: GenerateRagAnswerParams): Promise<GenerateRagAnswerResult> {
  const {
    userId,
    userQuery,
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    conversationHistory = [],
    documentIds,
    topK,
    chatCompletionFn,
  } = params;

  const retrievedChunks = await retrieveRelevantChunks(userId, userQuery, { topK, documentIds });

  const built = buildPrompt({
    systemPrompt,
    retrievedChunks,
    conversationHistory,
    userQuery,
  });

  const completion = await chatCompletionFn(built.messages);

  return {
    answer: completion.content,
    sources: retrievedChunks,
    provider: completion.provider,
    meta: {
      chunksRetrieved: retrievedChunks.length,
      chunksUsedInPrompt: built.chunksUsedCount,
      contextUsedChars: built.contextUsedChars,
    },
  };
}