import type { Response } from "express";

export const errorHandler = (
  res: Response,
  status: Number,
  success: Boolean,
  message: String,
  error: any,
) => {
  return res.status(Number(status)).json({
    success,
    message,
    error,
  });
};