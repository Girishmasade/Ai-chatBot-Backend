import { Types } from 'mongoose';
import { ChunkModel } from '@/moduels/chunk/chunk.model.js';
import { ChunkEmbeddingStatus } from '@/moduels/chunk/chunk.types.js';
import { embedTexts } from '@/moduels/embedding/embedding.service.js';
import { upsertVectors, type VectorRecord } from '@/vectorStore/pinecone.client.js';
import { markEmbeddingComplete, markEmbeddingFailed } from '@/moduels/document/document.service.js';

export async function embedDocumentChunks(documentId: Types.ObjectId, userId: Types.ObjectId): Promise<void> {
  const chunks = await ChunkModel.find({
    documentId,
    embeddingStatus: ChunkEmbeddingStatus.PENDING,
  }).sort({ chunkIndex: 1 });

  if (chunks.length === 0) {
    await markEmbeddingComplete(documentId);
    return;
  }

  try {
    const vectors = await embedTexts(chunks.map((c) => c.content));

    if (vectors.length !== chunks.length) {
      throw new Error(`Embedding count mismatch: expected ${chunks.length}, got ${vectors.length}`);
    }

    const vectorRecords: VectorRecord[] = chunks.map((chunk, i) => ({
      id: chunk._id.toString(),
      values: vectors[i],
      metadata: {
        documentId: documentId.toString(),
        userId: userId.toString(),
        chunkIndex: chunk.chunkIndex,
      },
    }));

    await upsertVectors(userId.toString(), vectorRecords);

    const bulkOps = chunks.map((chunk) => ({
      updateOne: {
        filter: { _id: chunk._id },
        update: {
          embeddingStatus: ChunkEmbeddingStatus.EMBEDDED,
          vectorId: chunk._id.toString(),
        },
      },
    }));
    await ChunkModel.bulkWrite(bulkOps);

    await markEmbeddingComplete(documentId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown embedding error';

    await ChunkModel.updateMany(
      { documentId, embeddingStatus: ChunkEmbeddingStatus.PENDING },
      { embeddingStatus: ChunkEmbeddingStatus.FAILED },
    );

    await markEmbeddingFailed(documentId, message);
  }
}

export async function deleteVectorsForChunks(userId: Types.ObjectId, chunkIds: string[]): Promise<void> {
  const { deleteVectorsByIds } = await import('@/vectorStore/pinecone.client.js');
  await deleteVectorsByIds(userId.toString(), chunkIds);
}