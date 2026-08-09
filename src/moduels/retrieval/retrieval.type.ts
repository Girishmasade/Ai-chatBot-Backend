export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  content: string;
  score: number;
  chunkIndex: number;
}

export interface RetrieveOptions {
  topK?: number;
  minScore?: number;
  documentIds?: string[]; // optional scoping to specific documents (e.g. "only search this file")
}