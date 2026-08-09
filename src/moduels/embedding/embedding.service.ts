import { RAG_CONFIG } from '@/config/rag.config.js';
import { ApiError } from '@/utils/apiError.util.js';
import { Pinecone } from '@pinecone-database/pinecone';
import type { ClientSession, Types } from 'mongoose';

const HF_API_BASE = 'https://api-inference.huggingface.co/models';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mean-pools token-level embeddings into a single sentence vector. Most
 * sentence-transformers models return an already-pooled vector per input
 * via the Inference API, but this is a defensive fallback in case a given
 * model returns per-token embeddings (shape: tokens x dims) instead of a
 * single pooled vector (shape: dims) — without this, a model swap could
 * silently upsert malformed vectors into Pinecone.
 */
function meanPoolIfNeeded(raw: unknown): number[] {
  if (Array.isArray(raw) && typeof raw[0] === 'number') {
    return raw as number[];
  }
  if (Array.isArray(raw) && Array.isArray(raw[0])) {
    const tokens = raw as number[][];
    const dims = tokens[0].length;
    const pooled = new Array(dims).fill(0);
    for (const token of tokens) {
      for (let i = 0; i < dims; i++) pooled[i] += token[i];
    }
    return pooled.map((v) => v / tokens.length);
  }
  throw new ApiError(502, 'Unexpected embedding response shape from Hugging Face Inference API');
}

async function callHfInferenceApi(inputs: string[]): Promise<number[][]> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    throw new Error('HUGGINGFACE_API_KEY is not set');
  }

  const url = `${HF_API_BASE}/${RAG_CONFIG.embedding.model}`;
  const { maxRetries, retryBaseDelayMs } = RAG_CONFIG.embedding;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs,
          options: { wait_for_model: true },
        }),
      });

      if (response.status === 503) {
        // Model is cold-starting on HF's shared infra — wait_for_model
        // should prevent this, but handle it defensively anyway.
        const body = await response.json().catch(() => ({}));
        const waitMs = typeof body?.estimated_time === 'number' ? body.estimated_time * 1000 : retryBaseDelayMs * 2 ** attempt;
        await sleep(Math.min(waitMs, 10_000));
        continue;
      }

      if (response.status === 429) {
        await sleep(retryBaseDelayMs * 2 ** attempt);
        continue;
      }

      if (!response.ok) {
        const errorBody = await response.text();
        throw new ApiError(502, `Hugging Face Inference API error (${response.status}): ${errorBody.slice(0, 300)}`);
      }

      const data = await response.json();

      // Response is one embedding (or one token-embedding matrix) per input,
      // in the same order as `inputs` — order preservation matters since we
      // zip this back against chunk ids by index.
      if (!Array.isArray(data) || data.length !== inputs.length) {
        throw new ApiError(502, 'Hugging Face response did not match input batch size');
      }

      return data.map((item: unknown) => meanPoolIfNeeded(item));
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await sleep(retryBaseDelayMs * 2 ** attempt);
        continue;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Embedding request failed after retries');
}

/**
 * Splits into batches and runs a bounded number of batches concurrently.
 * Simple semaphore, no external dependency — matches "no scope creep,
 * production-ready" without pulling in p-limit for one use site.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const { batchSize, maxConcurrentBatches } = RAG_CONFIG.embedding;
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    batches.push(texts.slice(i, i + batchSize));
  }

  const results: number[][][] = new Array(batches.length);
  let nextBatchIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const currentIndex = nextBatchIndex++;
      if (currentIndex >= batches.length) return;
      results[currentIndex] = await callHfInferenceApi(batches[currentIndex]);
    }
  }

  const workers = Array.from({ length: Math.min(maxConcurrentBatches, batches.length) }, () => worker());
  await Promise.all(workers);

  return results.flat();
}

export async function embedSingleText(text: string): Promise<number[]> {
  const [vector] = await embedTexts([text]);
  return vector;
}

export async function deleteVectorsForChunks(userId: Types.ObjectId, vectorIds: string[]): Promise<void> {
  const { deleteVectorsByIds } = await import('@/vectorStore/pinecone.client.js');
  await deleteVectorsByIds(userId.toString(), vectorIds);
}