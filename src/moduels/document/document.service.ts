import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import type { FilterQuery, Types } from 'mongoose';
import { DocumentModel } from '@/moduels/document/document.model.js';
import type{
  DocumentFileType,
  DocumentStatus,
  StorageProviderType,
  StorageProvider,
  IDocument,
  UploadDocumentInput,
  DocumentListQuery,
} from '@/moduels/document/document.types.js';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '@/moduels/document/document.validation.js';
import { ApiError } from '@/utils/apiError.util.js';
import { extractText, cleanText } from '@/moduels/document/document.extraction.service.js';
import { createChunksForDocument } from '@/moduels/chunk/chunk.service.js';
import { ChunkModel } from '@/moduels/chunk/chunk.model.js';

/**
 * ---- Storage abstraction -------------------------------------------------
 * Local-disk implementation for now. Swapping to S3 later means adding an
 * S3StorageProvider class implementing the same interface and changing
 * getStorageProvider() below — no service/controller changes required.
 */
const LOCAL_STORAGE_ROOT = process.env.DOCUMENT_STORAGE_ROOT || path.resolve(process.cwd(), 'storage', 'documents');

class LocalStorageProvider implements StorageProvider {
  async save(buffer: Buffer, key: string): Promise<{ storagePath: string }> {
    const fullPath = path.join(LOCAL_STORAGE_ROOT, key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);
    return { storagePath: key };
  }

  async read(storagePath: string): Promise<Buffer> {
    const fullPath = path.join(LOCAL_STORAGE_ROOT, storagePath);
    return fs.readFile(fullPath);
  }

  async delete(storagePath: string): Promise<void> {
    const fullPath = path.join(LOCAL_STORAGE_ROOT, storagePath);
    await fs.rm(fullPath, { force: true });
  }
}

function getStorageProvider(_type: StorageProviderType = StorageProviderType.LOCAL): StorageProvider {
  // Single branch today; becomes a switch when S3 is added. Kept as a
  // function (not a static import) so callers never depend on which
  // provider is active.
  return new LocalStorageProvider();
}

function computeChecksum(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * ---- Ingestion queue hook --------------------------------------------------
 * Deliberately isolated behind one function. Today it runs extraction
 * in-process (fire-and-forget, errors caught and persisted onto the
 * document). When BullMQ is introduced, this becomes
 * `await documentProcessingQueue.add('extract', { documentId })` with zero
 * changes to uploadDocument() below.
 */
function enqueueProcessing(documentId: Types.ObjectId): void {
  setImmediate(() => {
    processDocument(documentId).catch((err) => {
      // Extraction failures must never crash the process — they are
      // terminal states on the document itself, surfaced to the user via
      // GET /documents/:id, not via unhandled rejections.
      // eslint-disable-next-line no-console
      console.error(`[Document] processing failed for ${documentId.toString()}:`, err);
    });
  });
}

/**
 * Pipeline conductor for Phase 2, Steps 2–3. Owns status transitions and
 * failure attribution end-to-end through chunking. The final hop —
 * EMBEDDING -> COMPLETED — is written by the Embedding module once it lands
 * (Phase 2, Step 3), which will call `markEmbeddingComplete()` /
 * `markEmbeddingFailed()` below rather than writing `Document.status`
 * directly, keeping all status-mutation logic in this one file.
 */
async function processDocument(documentId: Types.ObjectId): Promise<void> {
  const document = await DocumentModel.findByIdAndUpdate(
    documentId,
    { status: DocumentStatus.EXTRACTING, $inc: { processingAttempts: 1 } },
    { new: true },
  ).select('+storagePath');

  if (!document) {
    // Document was deleted mid-flight (race with a delete request) — not an
    // error worth failing loudly over, just stop.
    return;
  }

  // Tracks the stage actually in flight so a catch block can attribute the
  // failure correctly — reading `document.status` from the stale fetch
  // above would always report EXTRACTING, even for a failure that happened
  // during CHUNKING.
  let currentStage: DocumentStatus = DocumentStatus.EXTRACTING;

  try {
    const storageProvider = getStorageProvider(document.storageProvider);
    const buffer = await storageProvider.read(document.storagePath);

    const { text, pageCount } = await extractText(document.fileType, buffer);
    const cleaned = cleanText(text);

    currentStage = DocumentStatus.CHUNKING;
    await DocumentModel.findByIdAndUpdate(documentId, {
      status: DocumentStatus.CHUNKING,
      extractedTextLength: cleaned.length,
      ...(pageCount ? { 'metadata.pageCount': pageCount } : {}),
    });

    const chunkCount = await createChunksForDocument(document._id, document.userId, cleaned);

    await DocumentModel.findByIdAndUpdate(documentId, {
      status: DocumentStatus.EMBEDDING,
      chunkCount,
    });

    currentStage = DocumentStatus.EMBEDDING;
   
    const { embedDocumentChunks } = await import('@/moduels/embedding/embedding.orchestrator.service .js');
    await embedDocumentChunks(document._id, document.userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown processing error';

    await DocumentModel.findByIdAndUpdate(documentId, {
      status: DocumentStatus.FAILED,
      failureReason: message,
      failedStage: currentStage,
    });
  }
}

/**
 * Called by the Embedding module once every chunk for a document has been
 * successfully embedded and upserted into Pinecone.
 */
export async function markEmbeddingComplete(documentId: Types.ObjectId): Promise<void> {
  await DocumentModel.findByIdAndUpdate(documentId, { status: DocumentStatus.COMPLETED });
}

/**
 * Called by the Embedding module on unrecoverable embedding failure
 * (e.g. HF Inference API exhausted retries for one or more chunks).
 */
export async function markEmbeddingFailed(documentId: Types.ObjectId, reason: string): Promise<void> {
  await DocumentModel.findByIdAndUpdate(documentId, {
    status: DocumentStatus.FAILED,
    failureReason: reason,
    failedStage: DocumentStatus.EMBEDDING,
  });
}

export async function uploadDocument(input: UploadDocumentInput): Promise<IDocument> {
  const { userId, file } = input;

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new ApiError(413, `File exceeds maximum size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`);
  }

  const fileType = ALLOWED_MIME_TYPES[file.mimetype];
  if (!fileType) {
    throw new ApiError(415, `Unsupported file type: ${file.mimetype}`);
  }

  const checksum = computeChecksum(file.buffer);

  const existing = await DocumentModel.findOne({ userId, 'metadata.checksum': checksum });
  if (existing) {
    throw new ApiError(409, 'This file has already been uploaded', {
      documentId: existing._id.toString(),
    });
  }

  const storageKey = `${userId.toString()}/${checksum}${path.extname(file.originalname)}`;
  const storageProvider = getStorageProvider(StorageProviderType.LOCAL);
  const { storagePath } = await storageProvider.save(file.buffer, storageKey);

  const document = await DocumentModel.create({
    userId,
    fileType,
    status: DocumentStatus.PENDING,
    storageProvider: StorageProviderType.LOCAL,
    storagePath,
    metadata: {
      originalFileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      checksum,
    },
    processingAttempts: 0,
  });

  enqueueProcessing(document._id);

  // await createAuditLog({ ... }) — see note at top of file: no AuditLog
  // module exists in this project yet.

  return document;
}

export async function listDocuments(
  userId: Types.ObjectId,
  query: DocumentListQuery,
): Promise<{ items: IDocument[]; total: number; page: number; limit: number }> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;

  const filter: FilterQuery<IDocument> = { userId };
  if (query.status) filter.status = query.status;
  if (query.fileType) filter.fileType = query.fileType;
  if (query.search) {
    filter['metadata.originalFileName'] = { $regex: query.search, $options: 'i' };
  }

  const [items, total] = await Promise.all([
    DocumentModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    DocumentModel.countDocuments(filter),
  ]);

  return { items, total, page, limit };
}

export async function getDocumentById(userId: Types.ObjectId, documentId: string): Promise<IDocument> {
  const document = await DocumentModel.findOne({ _id: documentId, userId });
  if (!document) {
    throw new ApiError(404, 'Document not found');
  }
  return document;
}

export async function deleteDocument(userId: Types.ObjectId, documentId: string): Promise<void> {
  const document = await DocumentModel.findOne({ _id: documentId, userId }).select('+storagePath');
  if (!document) {
    throw new ApiError(404, 'Document not found');
  }

  const storageProvider = getStorageProvider(document.storageProvider);
  await storageProvider.delete(document.storagePath);

  // Close the gap flagged in Step 2: remove the corresponding Pinecone
  // vectors before deleting the Chunk records that hold each vectorId.
  // Dynamic import to avoid a hard compile-time dependency of Document on
  // Embedding for what is, architecturally, a one-directional cleanup call.
  const chunksToDelete = await ChunkModel.find({ documentId: document._id }).select('vectorId');
  const vectorIds = chunksToDelete.map((c) => c.vectorId).filter((id): id is string => Boolean(id));
  if (vectorIds.length > 0) {
    const {deleteVectorsForChunks } = await import('@/moduels/embedding/embedding.orchestrator.service .js');
    await deleteVectorsForChunks(document.userId, vectorIds);
  }

  await ChunkModel.deleteMany({ documentId: document._id });
  await DocumentModel.deleteOne({ _id: document._id });

  // await createAuditLog({ ... }) — see note at top of file.
}