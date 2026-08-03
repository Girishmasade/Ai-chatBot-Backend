import { Router } from 'express';
import { authMiddleware } from '@/middlewares/auth.middleware.js';
import { previewPromptHandler } from '@/moduels/prompt/promptbuilder.controller.js';

const PromptBuilderRoute = Router();

PromptBuilderRoute.use(authMiddleware);
PromptBuilderRoute.post('/preview', previewPromptHandler);

export default PromptBuilderRoute;