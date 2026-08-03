import { Schema, model, Model } from 'mongoose';
import {type IChunk, ChunkEmbeddingStatus } from '@/moduels/chunk/chunk.types.js';

const chunkSchema = new Schema<IChunk>(
  {
    documentId: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    chunkIndex: {
      type: Number,
      required: true,
      min: 0,
    },
    content: {
      type: String,
      required: true,
    },
    charCount: {
      type: Number,
      required: true,
      min: 0,
    },
    approxTokenCount: {
      type: Number,
      required: true,
      min: 0,
    },
    embeddingStatus: {
      type: String,
      enum: Object.values(ChunkEmbeddingStatus),
      required: true,
      default: ChunkEmbeddingStatus.PENDING,
      index: true,
    },
    vectorId: {
      type: String,
      index: true,
      sparse: true,
    },
  },
  { timestamps: true },
);

// Fetching all chunks of a document in stable reading order — the core
// access pattern for both the embedding stage and any "view full document"
// debug/admin screen.
chunkSchema.index({ documentId: 1, chunkIndex: 1 }, { unique: true });

// Retrieval-side query: "give me this user's chunks still pending embedding"
// (used by retry/backfill jobs once BullMQ is introduced).
chunkSchema.index({ userId: 1, embeddingStatus: 1 });

export const ChunkModel: Model<IChunk> = model<IChunk>('Chunk', chunkSchema);