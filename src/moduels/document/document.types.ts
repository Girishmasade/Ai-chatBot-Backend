import { Types } from 'mongoose';

export enum DocumentFileType {
  PDF = 'PDF',
  DOCX = 'DOCX',
  TXT = 'TXT',
  MARKDOWN = 'MARKDOWN',
}
 
export enum DocumentStatus {
  PENDING = 'PENDING', 
  EXTRACTING = 'EXTRACTING', 
  CHUNKING = 'CHUNKING', 
  EMBEDDING = 'EMBEDDING', 
  COMPLETED = 'COMPLETED', 
  FAILED = 'FAILED', 
}

export enum StorageProviderType {
  LOCAL = 'LOCAL',
  S3 = 'S3', 
}
 

export interface DocumentMetadata {
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  pageCount?: number; // populated for PDF/DOCX after extraction
  checksum: string; // SHA-256 of raw file — used for duplicate detection
}

export interface IDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  fileType: DocumentFileType;
  status: DocumentStatus;
  storageProvider: StorageProviderType;
  storagePath: string; // provider-relative path/key, never a public URL
  metadata: DocumentMetadata;
  extractedTextLength?: number; // set after extraction, useful for UI + debugging
  chunkCount?: number; // set after chunking stage
  failureReason?: string; // human-readable, set only when status === FAILED
  failedStage?: DocumentStatus; // which stage failed, for retry logic
  processingAttempts: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface StorageProvider {
  save(buffer: Buffer, key: string): Promise<{ storagePath: string }>;
  read(storagePath: string): Promise<Buffer>;
  delete(storagePath: string): Promise<void>;
}
 
export interface UploadDocumentInput {
  userId: Types.ObjectId;
  file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  };
}
 

export interface DocumentListQuery {
  page?: number;
  limit?: number;
  status?: DocumentStatus;
  fileType?: DocumentFileType;
  search?: string; // matches against originalFileName
}