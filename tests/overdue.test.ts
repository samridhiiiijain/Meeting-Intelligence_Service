import { describe, it, expect } from 'vitest';
import { overdueWhere } from '../src/modules/actionItems/actionItems.service';

describe('overdueWhere', () => {
  it('excludes COMPLETED and requires a past due date', () => {
    const now = new Date('2026-06-05T00:00:00Z');
    const where = overdueWhere(now);
    expect(where.status).toEqual({ not: 'COMPLETED' });
    expect(where.dueDate).toEqual({ not: null, lt: now });
  });

  it('defaults `now` to the current time', () => {
    const before = Date.now();
    const where = overdueWhere();
    const lt = (where.dueDate as { lt: Date }).lt.getTime();
    expect(lt).toBeGreaterThanOrEqual(before);
  });
});
