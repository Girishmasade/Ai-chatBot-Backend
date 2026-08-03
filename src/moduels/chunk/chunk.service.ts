import { Types } from 'mongoose';
import { ChunkModel } from '@/moduels/chunk/chunk.model.js';
import {type ChunkingOptions, ChunkEmbeddingStatus } from '@/moduels/chunk/chunk.types.js';

/**
 * Chunk size is chosen conservatively against the embedding model's token
 * ceiling, not the LLM's context window — the embedding step is the
 * tightest constraint in the pipeline. Most sentence-transformer models
 * served via HF Inference API (e.g. all-MiniLM-L6-v2) truncate at 256
 * tokens. ~1000 characters ≈ 200–250 tokens for typical English prose,
 * leaving headroom. If you later pick a model with a larger context
 * (e.g. an 8k-token embedding model), raise CHUNKING_DEFAULTS accordingly —
 * this is the one place that needs to change.
 */
export const CHUNKING_DEFAULTS: ChunkingOptions = {
  maxChunkChars: 1000,
  overlapChars: 150,
};

function estimateTokenCount(text: string): number {
  // Rough heuristic (~4 chars/token for English). Good enough for capacity
  // planning and UI display; the embedding provider does its own real
  // tokenization and truncation regardless.
  return Math.ceil(text.length / 4);
}

/**
 * Splits on paragraph/sentence boundaries where possible so chunks don't
 * sever mid-sentence. Falls back to a hard character cut only when a single
 * "sentence" exceeds maxChunkChars on its own (e.g. unbroken text blobs).
 */
export function splitTextIntoChunks(text: string, options: ChunkingOptions = CHUNKING_DEFAULTS): string[] {
  const { maxChunkChars, overlapChars } = options;
  const sentences = text.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) ?? [text];

  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (sentence.length > maxChunkChars) {
      // Single oversized sentence — hard-split it on its own, flushing
      // whatever was accumulated first.
      if (current.trim()) chunks.push(current.trim());
      current = '';
      for (let i = 0; i < sentence.length; i += maxChunkChars - overlapChars) {
        chunks.push(sentence.slice(i, i + maxChunkChars).trim());
      }
      continue;
    }

    if ((current + sentence).length > maxChunkChars) {
      chunks.push(current.trim());
      // Seed next chunk with a trailing slice of the previous one for
      // overlap, so context isn't lost at the boundary.
      const overlapSeed = current.slice(Math.max(0, current.length - overlapChars));
      current = overlapSeed + sentence;
    } else {
      current += sentence;
    }
  }

  if (current.trim()) chunks.push(current.trim());

  return chunks.filter((c) => c.length > 0);
}

export async function createChunksForDocument(
  documentId: Types.ObjectId,
  userId: Types.ObjectId,
  cleanedText: string,
): Promise<number> {
  const textChunks = splitTextIntoChunks(cleanedText);

  if (textChunks.length === 0) {
    throw new Error('Chunking produced zero chunks from non-empty text — unexpected input shape');
  }

  // Clear any previous chunks first (covers the reprocess/retry path —
  // without this, retrying a failed document would append duplicates
  // alongside stale chunks from the earlier attempt).
  await ChunkModel.deleteMany({ documentId });

  const docs = textChunks.map((content, index) => ({
    documentId,
    userId,
    chunkIndex: index,
    content,
    charCount: content.length,
    approxTokenCount: estimateTokenCount(content),
    embeddingStatus: ChunkEmbeddingStatus.PENDING,
  }));

  await ChunkModel.insertMany(docs, { ordered: true });

  return docs.length;
}