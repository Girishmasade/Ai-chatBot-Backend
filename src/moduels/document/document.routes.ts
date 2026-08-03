import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '@/middlewares/auth.middleware.js';
import {
  uploadDocumentHandler,
  listDocumentsHandler,
  getDocumentHandler,
  deleteDocumentHandler,
} from '@/moduels/document/document.controller.js';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '@/moduels/document/document.validation.js';

const DocumentRouter = Router();

/**
 * Memory storage: files are held in-memory only long enough to compute a
 * checksum and hand off to the StorageProvider (document.service.ts). For
 * the 25MB cap this is fine; if the cap is raised significantly, switch to
 * multer.diskStorage with a temp dir and stream-based checksum instead of
 * buffering the whole file in process memory.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES[file.mimetype]) {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  },
});

// All document routes require authentication. No admin-only routes here —
// documents are strictly user-scoped (RAG corpora are per-user, not global),
// so RBAC beyond "is authenticated" is enforced at the query level in the
// service layer (every query is filtered by userId).
DocumentRouter.use(authMiddleware);

DocumentRouter.post('/upload', upload.single('file'), uploadDocumentHandler);
DocumentRouter.get('/', listDocumentsHandler);
DocumentRouter.get('/:id', getDocumentHandler);
DocumentRouter.delete('/:id', deleteDocumentHandler);

export default DocumentRouter;