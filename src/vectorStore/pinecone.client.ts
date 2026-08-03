import { Pinecone, Index } from '@pinecone-database/pinecone';
import { RAG_CONFIG } from '@/config/rag.config.js';
import { PINECONE_API_KEY, PINECONE_REGION } from '@/env/env.import.js';

/**
 * Singleton client + lazily-resolved index handle. Every module that talks
 * to Pinecone (Embedding for upsert, Retrieval for query) imports from here
 * rather than constructing its own client — keeps auth/config in one place
 * and makes it trivial to add index-existence checks or multi-index
 * routing later without touching callers.
 */
let pineconeClient: Pinecone | null = null;
let pineconeIndex: Index | null = null;

function getClient(): Pinecone {
  if (!pineconeClient) {
    const apiKey = PINECONE_API_KEY;
    if (!apiKey) {
      throw new Error('PINECONE_API_KEY is not set');
    }
    pineconeClient = new Pinecone({ apiKey });
  }
  return pineconeClient;
}

export function getPineconeIndex(): Index {
  if (!pineconeIndex) {
    pineconeIndex = getClient().index(RAG_CONFIG.pinecone.indexName);
  }
  return pineconeIndex;
}

/**
 * Idempotent index bootstrap — safe to call on app startup. Does nothing if
 * the index already exists. Pinecone index creation is eventually-consistent
 * (can take up to ~60s to become ready), so this is intended for
 * infra/deploy scripts, not for a hot request path.
 */
export async function ensurePineconeIndexExists(): Promise<void> {
  const client = getClient();
  const existing = await client.listIndexes();
  const alreadyExists = existing.indexes?.some((idx) => idx.name === RAG_CONFIG.pinecone.indexName);

  if (alreadyExists) return;

  await client.createIndex({
    name: RAG_CONFIG.pinecone.indexName,
    dimension: RAG_CONFIG.embedding.dimensions,
    metric: RAG_CONFIG.pinecone.metric,
    spec: {
      serverless: {
        cloud: 'aws',
        region: PINECONE_REGION || 'us-east-1',
      },
    },
  });
}

export interface VectorRecord {
  id: string; // we use the Chunk's Mongo _id (as string) as the vector id — 1:1 mapping, no separate id scheme to track
  values: number[];
  metadata: {
    documentId: string;
    userId: string;
    chunkIndex: number;
  };
}

export async function upsertVectors(userId: string, vectors: VectorRecord[]): Promise<void> {
  const index = getPineconeIndex();
  // Namespaced per user — see rationale in module README. Pinecone upsert
  // is already idempotent on id, so retrying a failed batch is safe.
  await index.namespace(userId).upsert(vectors);
}

export async function queryVectors(
  userId: string,
  queryVector: number[],
  topK: number,
  filter?: Record<string, unknown>,
): Promise<Array<{ id: string; score: number; metadata: VectorRecord['metadata'] }>> {
  const index = getPineconeIndex();
  const result = await index.namespace(userId).query({
    vector: queryVector,
    topK,
    includeMetadata: true,
    ...(filter ? { filter } : {}),
  });

  return (result.matches ?? []).map((match) => ({
    id: match.id,
    score: match.score ?? 0,
    metadata: match.metadata as unknown as VectorRecord['metadata'],
  }));
}

export async function deleteVectorsByIds(userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const index = getPineconeIndex();
  await index.namespace(userId).deleteMany(ids);
}