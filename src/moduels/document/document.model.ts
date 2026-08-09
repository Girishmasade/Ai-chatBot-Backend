import { Schema, model, Model } from 'mongoose';
import {
  type IDocument,
  DocumentFileType,
  DocumentStatus,
  StorageProviderType,
} from '@/moduels/document/document.types.js';

const documentMetadataSchema = new Schema(
  {
    originalFileName: { type: String, required: true, trim: true, maxlength: 255 },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true, min: 0 },
    pageCount: { type: Number, min: 0 },
    checksum: { type: String, required: true, index: true },
  },
  { _id: false },
);

const documentSchema = new Schema<IDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    fileType: {
      type: String,
      enum: Object.values(DocumentFileType),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(DocumentStatus),
      required: true,
      default: DocumentStatus.PENDING,
      index: true,
    },
    storageProvider: {
      type: String,
      enum: Object.values(StorageProviderType),
      required: true,
      default: StorageProviderType.LOCAL,
    },
    storagePath: {
      type: String,
      required: true,
      select: false, // internal path — never returned to clients by default
    },
    metadata: {
      type: documentMetadataSchema,
      required: true,
    },
    extractedTextLength: { type: Number, min: 0 },
    chunkCount: { type: Number, min: 0 },
    failureReason: { type: String, maxlength: 1000 },
    failedStage: {
      type: String,
      enum: Object.values(DocumentStatus),
    },
    processingAttempts: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Common query pattern: "give me this user's documents, optionally by status,
// most recent first" — compound index supports both the filter and the sort.
documentSchema.index({ userId: 1, status: 1, createdAt: -1 });

// Duplicate-upload detection scoped per user (same file re-uploaded by two
// different users is not a duplicate — RAG corpora are user-scoped here).
documentSchema.index({ userId: 1, 'metadata.checksum': 1 }, { unique: true });

export const DocumentModel: Model<IDocument> = model<IDocument>('Document', documentSchema);