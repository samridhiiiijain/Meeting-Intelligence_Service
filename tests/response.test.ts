import { describe, it, expect } from 'vitest';
import { buildError, buildSuccess } from '../src/utils/response';
import { AppError } from '../src/utils/errors';

describe('response envelope', () => {
  it('builds a success envelope', () => {
    expect(buildSuccess('trace-1', { hello: 'world' })).toEqual({
      traceId: 'trace-1',
      success: true,
      data: { hello: 'world' },
    });
  });

  it('builds an error envelope without details', () => {
    expect(buildError('trace-2', 'NOT_FOUND', 'missing')).toEqual({
      traceId: 'trace-2',
      success: false,
      error: { code: 'NOT_FOUND', message: 'missing' },
    });
  });

  it('includes details when provided', () => {
    const env = buildError('trace-3', 'VALIDATION_ERROR', 'bad', [{ field: 'email' }]);
    expect(env.error.details).toEqual([{ field: 'email' }]);
  });
});

describe('AppError', () => {
  it('maps codes to HTTP statuses', () => {
    expect(AppError.notFound().status).toBe(404);
    expect(AppError.unauthorized().status).toBe(401);
    expect(AppError.forbidden().status).toBe(403);
    expect(AppError.badRequest('x').status).toBe(400);
    expect(AppError.conflict('x').status).toBe(409);
    expect(AppError.dependency('x').status).toBe(502);
  });

  it('is operational and carries its code', () => {
    const err = AppError.badRequest('nope', { a: 1 });
    expect(err.isOperational).toBe(true);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details).toEqual({ a: 1 });
  });
});
