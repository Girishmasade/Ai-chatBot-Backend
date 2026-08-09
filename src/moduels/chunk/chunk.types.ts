import { Types } from 'mongoose';

export interface IChunk {
  _id: Types.ObjectId;
  documentId: Types.ObjectId;
  userId: Types.ObjectId; // denormalized for cheap ownership checks during retrieval
  chunkIndex: number; // position within the document, 0-based, stable ordering
  content: string;
  charCount: number;
  approxTokenCount: number; // estimated, not exact — see chunk.service.ts
  embeddingStatus: ChunkEmbeddingStatus;
  vectorId?: string; // Pinecone vector id once embedded — set by Embedding module
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Separate from DocumentStatus deliberately: a document's overall status is
 * "CHUNKING" while individual chunks are still PENDING for embedding. This
 * lets partial-failure retries target only the chunks that failed, instead
 * of re-embedding an entire document.
 */
export enum ChunkEmbeddingStatus {
  PENDING = 'PENDING',
  EMBEDDED = 'EMBEDDED',
  FAILED = 'FAILED',
}

export interface CleanAndSplitResult {
  chunks: string[];
  totalCharCount: number;
}

export interface ChunkingOptions {
  maxChunkChars: number;
  overlapChars: number;
}