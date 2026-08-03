import { z } from 'zod';

export const promptPreviewBodySchema = z.object({
  systemPrompt: z.string().max(4000).optional().default('You are a helpful assistant that answers questions using the provided context when relevant.'),
  retrievedChunks: z
    .array(
      z.object({
        content: z.string(),
        documentId: z.string(),
        score: z.number(),
      }),
    )
    .max(50)
    .default([]),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(8000),
      }),
    )
    .max(50)
    .default([]),
  userQuery: z.string().trim().min(1).max(4000),
});

export type PromptPreviewBodyDto = z.infer<typeof promptPreviewBodySchema>;