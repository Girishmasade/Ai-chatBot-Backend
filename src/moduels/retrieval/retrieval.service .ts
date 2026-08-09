import { Types } from 'mongoose';
import { ChunkModel } from '@/moduels/chunk/chunk.model.js';
import { embedSingleText } from '@/moduels/embedding/embedding.service.js';
import { queryVectors } from '@/vectorStore/pinecone.client.js';
import { RAG_CONFIG } from '@/config/rag.config.js';
import type{ RetrievedChunk, RetrieveOptions } from '@/moduels/retrieval/retrieval.type.js';
  
export async function retrieveRelevantChunks(
  userId: Types.ObjectId,
  queryText: string,
  options: RetrieveOptions = {},
): Promise<RetrievedChunk[]> {
  const topK = Math.min(options.topK ?? RAG_CONFIG.retrieval.defaultTopK, RAG_CONFIG.retrieval.maxTopK);
  const minScore = options.minScore ?? RAG_CONFIG.retrieval.minScoreThreshold;

  const queryVector = await embedSingleText(queryText);
  const pineconeFilter = options.documentIds && options.documentIds.length > 0
    ? { documentId: { $in: options.documentIds } }
    : undefined;
  const matches = await queryVectors(userId.toString(), queryVector, topK, pineconeFilter);

  const relevant = matches.filter((m) => m.score >= minScore);
  if (relevant.length === 0) return [];

  const chunkIds = relevant.map((m) => m.id);
  const chunks = await ChunkModel.find({ _id: { $in: chunkIds } });
  const chunkById = new Map(chunks.map((c) => [c._id.toString(), c]));

  const results: RetrievedChunk[] = [];
  for (const match of relevant) {
    const chunk = chunkById.get(match.id);
    if (!chunk) continue; // vector exists but Mongo record was deleted — skip rather than throw, retrieval should degrade gracefully

    results.push({
      chunkId: chunk._id.toString(),
      documentId: chunk.documentId.toString(),
      content: chunk.content,
      score: match.score,
      chunkIndex: chunk.chunkIndex,
    });
  }

  return results.sort((a, b) => b.score - a.score);
}