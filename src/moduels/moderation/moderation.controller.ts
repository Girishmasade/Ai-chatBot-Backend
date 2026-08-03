import { Types } from 'mongoose';
import { successHandler } from '@/utils/successHandler.util.js';
import {
  moderateText,
  listBlocklistTerms,
  addBlocklistTerm,
  removeBlocklistTerm,
  listModerationLogs,
} from '@/moduels/moderation/moderation.service.js';
import {
  testModerationBodySchema,
  addBlocklistTermBodySchema,
  blocklistIdParamSchema,
  listModerationLogsQuerySchema,
} from '@/moduels/moderation/moderation.validation.js';
import { AsyncHandler } from '@/utils/AsyncHandler.js';
import type { AuthUser } from '../auth/auth.payload.js';
/**
 * Every handler in this file is admin-only (see moderation.routes.ts —
 * `authorize(['ADMIN', 'SUPER_ADMIN'])`). Regular users never see raw
 * category scores or manage the blocklist directly; they only ever get the
 * generic MODERATION_BLOCKED_MESSAGE via rag.controller.ts's
 * moderateOrThrow().
 */

/**
 * POST /api/moderation/test
 * Lets an admin see the full category breakdown for arbitrary text —
 * useful for tuning BLOCKED_CATEGORIES / minScoreThreshold before rolling
 * a policy change out to real users.
 */
export const testModerationHandler = AsyncHandler(async (req, res) => {
  const { text } = testModerationBodySchema.parse(req.body);
  const result = await moderateText(text);
  return successHandler(res, 200, true, 'Moderation check completed', {result});
});

/**
 * GET /api/moderation/blocklist
 */
export const listBlocklistHandler = AsyncHandler(async (_req, res) => {
  const terms = await listBlocklistTerms();
  return successHandler(res, 200, true,'Blocklist retrieved successfully', {terms});
});

/**
 * POST /api/moderation/blocklist
 */
export const addBlocklistTermHandler = AsyncHandler(async (req, res) => {
  const { term } = addBlocklistTermBodySchema.parse(req.body);
  const entry = await addBlocklistTerm(term, new Types.ObjectId((req.user! as AuthUser).id));
  return successHandler(res, 201, true,'Term added to blocklist', entry);
});

/**
 * DELETE /api/moderation/blocklist/:id
 */
export const removeBlocklistTermHandler = AsyncHandler(async (req, res) => {
  const { id } = blocklistIdParamSchema.parse(req.params);
  await removeBlocklistTerm(id);
  return successHandler(res, 200, true, 'Term removed from blocklist', {});
});

/**
 * GET /api/moderation/logs
 * Backs an admin "flagged prompts" dashboard panel.
 */
export const listModerationLogsHandler = AsyncHandler(async (req, res) => {
  const { page, limit } = listModerationLogsQuerySchema.parse(req.query);
  const { items, total } = await listModerationLogs(page, limit);
  return successHandler(res, 200, true, 'Moderation logs retrieved successfully', {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});