import { Router } from 'express';
import { authMiddleware } from "@/middlewares/auth.middleware.js";
import { ragQueryHandler } from './rag.controller.js';

const RagRouter = Router();

RagRouter.use(authMiddleware);
RagRouter.post('/query', ragQueryHandler);

export default RagRouter;