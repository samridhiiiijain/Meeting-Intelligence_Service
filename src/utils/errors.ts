/**
 * Application error model.
 *
 * Every expected failure is expressed as an `AppError` carrying a stable machine
 * `code`, an HTTP `status`, and an optional `details` payload. The global error
 * handler maps these into the unified error envelope. Anything that is NOT an
 * AppError is treated as an unexpected `INTERNAL_ERROR` (500).
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNPROCESSABLE'
  | 'RATE_LIMITED'
  | 'DEPENDENCY_ERROR'
  | 'INTERNAL_ERROR';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  RATE_LIMITED: 429,
  DEPENDENCY_ERROR: 502,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;
  public readonly details?: unknown;
  /** Whether this error is safe/expected (vs an unexpected crash). */
  public readonly isOperational: boolean;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError('VALIDATION_ERROR', message, details);
  }
  static unauthorized(message = 'Authentication required') {
    return new AppError('UNAUTHORIZED', message);
  }
  static forbidden(message = 'You do not have access to this resource') {
    return new AppError('FORBIDDEN', message);
  }
  static notFound(message = 'Resource not found') {
    return new AppError('NOT_FOUND', message);
  }
  static conflict(message: string, details?: unknown) {
    return new AppError('CONFLICT', message, details);
  }
  static dependency(message: string, details?: unknown) {
    return new AppError('DEPENDENCY_ERROR', message, details);
  }
}
