import { describe, it, expect } from 'vitest';
import { buildPageMeta, parsePagination } from '../src/utils/pagination';

describe('parsePagination', () => {
  it('applies defaults when params are absent', () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it('computes skip from page and limit', () => {
    expect(parsePagination({ page: 3, limit: 10 })).toEqual({ page: 3, limit: 10, skip: 20 });
  });

  it('falls back to defaults on non-numeric input', () => {
    expect(parsePagination({ page: 'abc', limit: 'xyz' })).toEqual({ page: 1, limit: 20, skip: 0 });
  });

  it('clamps out-of-range values into bounds', () => {
    expect(parsePagination({ limit: 10000 }).limit).toBe(100); // above max → max
    expect(parsePagination({ page: -5, limit: -5 })).toEqual({ page: 1, limit: 1, skip: 0 }); // below min → min
  });
});

describe('buildPageMeta', () => {
  it('computes totalPages via ceil', () => {
    expect(buildPageMeta(45, { page: 1, limit: 20, skip: 0 })).toEqual({
      page: 1,
      limit: 20,
      total: 45,
      totalPages: 3,
    });
  });

  it('returns 0 pages for an empty result set', () => {
    expect(buildPageMeta(0, { page: 1, limit: 20, skip: 0 }).totalPages).toBe(0);
  });
});
