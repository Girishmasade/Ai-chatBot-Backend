/**
 * Centralized custom error class. Every deliberate, expected failure across
 * the codebase (validation failure, not found, conflict, upstream provider
 * error, etc.) should throw this rather than a bare Error — it's what lets
 * the centralized error handler (errorHandler(), in your Express error
 * middleware) distinguish "an operational error we anticipated and can
 * return a clean response for" from "an unexpected bug that should be
 * logged loudly and return a generic 500."
 *
 * `isOperational: true` is that signal. A caught ApiError -> respond with
 * its statusCode/message. A caught plain Error/TypeError/etc -> log the
 * full stack, respond with a generic "Something went wrong" 500 (never leak
 * internals to the client — see your Error Handling principles).
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown, isOperational = true) {
    super(message);

    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    // Excludes the ApiError constructor itself from the captured stack
    // trace, so the trace points at the actual throw site in application
    // code instead of this file.
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convenience factories for the handful of status codes used repeatedly
   * across modules in this codebase. Not exhaustive — for anything else,
   * just call `new ApiError(statusCode, message)` directly.
   */
  static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = 'Unauthorized'): ApiError {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Forbidden'): ApiError {
    return new ApiError(403, message);
  }

  static notFound(message = 'Resource not found'): ApiError {
    return new ApiError(404, message);
  }

  static conflict(message: string, details?: unknown): ApiError {
    return new ApiError(409, message, details);
  }

  static unprocessable(message: string, details?: unknown): ApiError {
    return new ApiError(422, message, details);
  }

  /**
   * For failures from an upstream dependency (HF Inference API, Pinecone,
   * OpenAI Moderation API, etc.) — 502 signals "we're fine, something we
   * depend on isn't," which is the accurate signal to send rather than a
   * generic 500.
   */
  static badGateway(message: string, details?: unknown): ApiError {
    return new ApiError(502, message, details);
  }

  static internal(message = 'Something went wrong', details?: unknown): ApiError {
    // isOperational: false is deliberate here — reaching this factory means
    // something unexpected happened that the codebase didn't have a more
    // specific error for. Treat it like an unhandled error for logging
    // purposes even though it's wrapped in an ApiError.
    return new ApiError(500, message, details, false);
  }
}