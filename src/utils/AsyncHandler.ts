import type { NextFunction, Request, Response } from "express";

type ControllerFn = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void | Response>;

export const AsyncHandler = (controller: ControllerFn) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await controller(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};
