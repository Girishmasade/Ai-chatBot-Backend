import { z } from 'zod';
import { DocumentFileType, DocumentStatus } from '@/moduels/document/document.types.js';

/**
 * Mime-type allowlist. This is the single source of truth for what the
 * upload endpoint accepts — multer's fileFilter and the service layer's
 * fileType resolution both read from this map, so adding a new format is
 * a one-line change here (plus an extractor in document.service.ts).
 */
export const ALLOWED_MIME_TYPES: Record<string, DocumentFileType> = {
  'application/pdf': DocumentFileType.PDF,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': DocumentFileType.DOCX,
  'text/plain': DocumentFileType.TXT,
  'text/markdown': DocumentFileType.MARKDOWN,
  'text/x-markdown': DocumentFileType.MARKDOWN,
};

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB — tune per infra budget

export const listDocumentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(DocumentStatus).optional(),
  fileType: z.nativeEnum(DocumentFileType).optional(),
  search: z.string().trim().max(255).optional(),
});

export const documentIdParamSchema = z.object({
  id: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid document id'),
});

export type ListDocumentsQueryDto = z.infer<typeof listDocumentsQuerySchema>;
export type DocumentIdParamDto = z.infer<typeof documentIdParamSchema>;