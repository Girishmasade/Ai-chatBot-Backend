import { type Request, type Response, type NextFunction } from "express";
import { type ZodSchema } from "zod";

type ParsedData = {
  body?: Record<string, unknown>;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
};

export const validate =
  (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    if (!result.success) {
      const errors = result.error.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));

      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
      return;
    }

    const data = result.data as ParsedData; // typed assertion

    if (data.body)   req.body   = data.body;
    if (data.params) req.params = data.params as Request["params"];
    if (data.query)   Object.assign(req.query, data.query); 
    next();
  };