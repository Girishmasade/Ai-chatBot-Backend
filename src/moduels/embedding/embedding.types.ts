export interface EmbeddingResult {
  chunkId: string;
  vector: number[];
}

export interface EmbedTextsOptions {
  isQuery?: boolean; // some sentence-transformer models benefit from a query prefix — see embedding.service.ts
}