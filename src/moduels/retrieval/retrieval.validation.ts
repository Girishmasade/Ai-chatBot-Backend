import { z } from 'zod';
import { RAG_CONFIG } from '@/config/rag.config.js';

export const retrievalSearchBodySchema = z.object({
  query: z.string().trim().min(1).max(2000),
  topK: z.coerce.number().int().min(1).max(RAG_CONFIG.retrieval.maxTopK).optional(),
  documentIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).max(50).optional(),
});

export type RetrievalSearchBodyDto = z.infer<typeof retrievalSearchBodySchema>;