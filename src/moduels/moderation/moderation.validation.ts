import { z } from 'zod';

export const testModerationBodySchema = z.object({
  text: z.string().trim().min(1).max(4000),
});

export const addBlocklistTermBodySchema = z.object({
  term: z.string().trim().min(1).max(200),
});

export const blocklistIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid blocklist entry id'),
});

export const listModerationLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});