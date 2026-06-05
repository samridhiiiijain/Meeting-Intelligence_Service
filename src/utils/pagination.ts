import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../config/constants';

export interface PageParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Parse and clamp pagination query params defensively.
 * Invalid / out-of-range inputs fall back to safe defaults rather than erroring,
 * so a bad `?page=abc` never breaks listing.
 */
export function parsePagination(query: {
  page?: unknown;
  limit?: unknown;
}): PageParams {
  const page = clampInt(query.page, DEFAULT_PAGE, 1, Number.MAX_SAFE_INTEGER);
  const limit = clampInt(query.limit, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
  return { page, limit, skip: (page - 1) * limit };
}

export function buildPageMeta(total: number, { page, limit }: PageParams): PageMeta {
  return {
    page,
    limit,
    total,
    totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
  };
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN;
  if (!Number.isFinite(n) || !Number.isInteger(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}
