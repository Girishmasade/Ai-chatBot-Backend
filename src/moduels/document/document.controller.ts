import { successHandler } from '@/utils/successHandler.util.js';
import * as documentService from '@/moduels/document/document.service.js';
import {
  listDocumentsQuerySchema,
  documentIdParamSchema,
} from '@/moduels/document/document.validation.js';
import { AsyncHandler } from '@/utils/AsyncHandler.js';
import { ApiError } from '@/utils/apiError.util.js';
import type { AuthUser } from '../auth/auth.payload.js';
import { Types } from 'mongoose';

export const uploadDocumentHandler = AsyncHandler(async (req, res, next) => {
  if (!req.file) {
    throw new ApiError(400, 'No file provided');
  }

  const document = await documentService.uploadDocument({
    userId: new Types.ObjectId((req.user as AuthUser)?.id!),
    file: {
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    },
  });

  return successHandler(res, 201, true, 'Document uploaded and queued for processing', {
    id: document._id,
    fileType: document.fileType,
    status: document.status,
    metadata: document.metadata,
    createdAt: document.createdAt,
  });
});

/**
 * GET /api/documents
 */
export const listDocumentsHandler = AsyncHandler(async (req, res) => {
  const query = listDocumentsQuerySchema.parse(req.query);

  const { items, total, page, limit } = await documentService.listDocuments(new Types.ObjectId((req.user as AuthUser)?.id!), query);

  return successHandler(res, 200, true, 'Documents retrieved successfully', {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

/**
 * GET /api/documents/:id
 */
export const getDocumentHandler = AsyncHandler(async (req, res) => {
  const { id } = documentIdParamSchema.parse(req.params);
  const document = await documentService.getDocumentById(new Types.ObjectId((req.user as AuthUser)?.id!), id);
  return successHandler(res, 200, true, 'Document retrieved successfully', {document});
});

/**
 * DELETE /api/documents/:id
 */
export const deleteDocumentHandler = AsyncHandler(async (req, res) => {
  const { id } = documentIdParamSchema.parse(req.params);
  await documentService.deleteDocument(new Types.ObjectId((req.user as AuthUser)?.id!), id);
  return successHandler(res, 200, true, 'Document deleted successfully', {});
});