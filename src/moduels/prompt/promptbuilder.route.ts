import { Router } from 'express';
import { authMiddleware } from '@/middlewares/auth.middleware.js';
import { previewPromptHandler, generateAntiHallucinationPromptHandler } from '@/moduels/prompt/promptbuilder.controller.js';

const PromptBuilderRoute = Router();

PromptBuilderRoute.use(authMiddleware);
PromptBuilderRoute.post('/preview', previewPromptHandler);
PromptBuilderRoute.post('/anti-hallucination', generateAntiHallucinationPromptHandler);

export default PromptBuilderRoute;