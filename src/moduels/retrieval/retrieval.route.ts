import { Router } from "express";
import { searchHandler } from "./retrieval.controller.js";
import { authMiddleware } from "@/middlewares/auth.middleware.js";

export const RetrievalRoute = Router()

RetrievalRoute.use(authMiddleware)

RetrievalRoute.post("/search", searchHandler)

export default RetrievalRoute