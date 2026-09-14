import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Invalid request data",
      details: err.errors.map(e => ({
        field: e.path.join("."),
        message: e.message
      }))
    });
    return;
  }

  if (err instanceof Error) {
    console.error("[ErrorHandler]", err.stack || err.message);
    res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: err.message || "An unexpected error occurred"
    });
    return;
  }

  console.error("[ErrorHandler] Unknown error", err);
  res.status(500).json({
    error: "INTERNAL_SERVER_ERROR",
    message: "An unknown error occurred"
  });
}
