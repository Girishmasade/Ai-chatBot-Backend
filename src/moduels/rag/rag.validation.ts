import { z } from 'zod';
import { RAG_CONFIG } from '@/config/rag.config.js';

export const ragQueryBodySchema = z.object({
  query: z.string().trim().min(1).max(4000),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(8000),
      }),
    )
    .max(50)
    .optional()
    .default([]),
  documentIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).max(50).optional(),
  topK: z.coerce.number().int().min(1).max(RAG_CONFIG.retrieval.maxTopK).optional(),
  systemPrompt: z.string().max(4000).optional(),
});

export type RagQueryBodyDto = z.infer<typeof ragQueryBodySchema>;