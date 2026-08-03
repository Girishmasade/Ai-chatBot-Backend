import { PINECONE_INDEX_NAME } from "@/env/env.import.js";

export const RAG_CONFIG = {
  embedding: {
    model: 'sentence-transformers/all-MiniLM-L6-v2',
    dimensions: 384,
    batchSize: 8,
    maxConcurrentBatches: 3,
    maxRetries: 3,
    retryBaseDelayMs: 500,
  },
  pinecone: {
    indexName: PINECONE_INDEX_NAME || 'rag-documents',
    metric: 'cosine' as const,
  },
  retrieval: {
    defaultTopK: 5,
    maxTopK: 20,
    minScoreThreshold: 0.35,
  },
  promptBuilder: {
    maxContextChars: 6000,
    maxHistoryMessages: 10,
  },
} as const;

// 