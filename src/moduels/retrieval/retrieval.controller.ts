import { successHandler } from '@/utils/successHandler.util.js';
import { retrieveRelevantChunks } from '@/moduels/retrieval/retrieval.service .js';
import { retrievalSearchBodySchema } from '@/moduels/retrieval/retrieval.validation.js';
import { AsyncHandler } from '@/utils/AsyncHandler.js';
import type { AuthUser } from '../auth/auth.payload.js';
import { Types } from 'mongoose';

export const searchHandler = AsyncHandler(async (req, res) => {
  const body = retrievalSearchBodySchema.parse(req.body);
 
  const results = await retrieveRelevantChunks(new Types.ObjectId((req.user as AuthUser).id), body.query, {
    topK: body.topK,
    documentIds: body.documentIds,
  });
 
  return successHandler(res, 200, true, 'Retrieval search completed', {
    query: body.query,
    resultCount: results.length,
    results,
  });
});