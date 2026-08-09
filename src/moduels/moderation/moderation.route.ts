import { authMiddleware, isAdmin } from '@/middlewares/auth.middleware.js';
import {
  testModerationHandler,
  listBlocklistHandler,
  addBlocklistTermHandler,
  removeBlocklistTermHandler,
  listModerationLogsHandler,
} from '@/moduels/moderation/moderation.controller.js';
import { Router } from 'express';
 
const ModerationRouter = Router();
 
ModerationRouter.use(authMiddleware);
ModerationRouter.use(isAdmin);
 
ModerationRouter.post('/test', testModerationHandler);
ModerationRouter.get('/blocklist', listBlocklistHandler);
ModerationRouter.post('/blocklist', addBlocklistTermHandler);
ModerationRouter.delete('/blocklist/:id', removeBlocklistTermHandler);
ModerationRouter.get('/logs', listModerationLogsHandler);
 
export default ModerationRouter;
 