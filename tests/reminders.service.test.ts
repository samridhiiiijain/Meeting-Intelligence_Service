import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setNotifier } from '../src/lib/notifier';

// Mock Prisma before importing the service
vi.mock('../src/lib/prisma', () => ({
  prisma: {
    actionItem: {
      findMany: vi.fn(),
    },
    reminder: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

// Mock env
vi.mock('../src/config/env', () => ({
  env: {
    REMINDER_DEDUPE_HOURS: 24,
    REMINDER_TO_OVERRIDE: '',
    LOG_LEVEL: 'info',
  },
  isProd: false,
}));

import { prisma } from '../src/lib/prisma';
import { remindersService } from '../src/modules/reminders/reminders.service';

const mockPrisma = prisma as unknown as {
  actionItem: { findMany: ReturnType<typeof vi.fn> };
  reminder: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};

const mockNotifier = { send: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  setNotifier(mockNotifier);
  mockPrisma.reminder.create.mockResolvedValue({});
});

const makeItem = (overrides: object = {}) => ({
  id: 'item-1',
  task: 'Write tests',
  assignee: 'alice@example.com',
  dueDate: new Date('2020-01-01'),
  meeting: { participants: ['alice@example.com'] },
  reminders: [],
  ...overrides,
});

describe('remindersService.run', () => {
  it('sends a reminder and returns sent=1 for a resolvable overdue item', async () => {
    mockPrisma.actionItem.findMany.mockResolvedValue([makeItem()]);
    mockNotifier.send.mockResolvedValue(undefined);

    const result = await remindersService.run('test');

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.skippedRecent).toBe(0);
    expect(result.unresolved).toBe(0);
    expect(mockNotifier.send).toHaveBeenCalledOnce();
    expect(mockPrisma.reminder.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SENT' }) }),
    );
  });

  it('skips items already reminded within the dedup window', async () => {
    mockPrisma.actionItem.findMany.mockResolvedValue([
      makeItem({ reminders: [{ id: 'r-1' }] }),
    ]);

    const result = await remindersService.run('test');

    expect(result.skippedRecent).toBe(1);
    expect(result.sent).toBe(0);
    expect(mockNotifier.send).not.toHaveBeenCalled();
  });

  it('records FAILED and increments unresolved when recipient cannot be resolved', async () => {
    mockPrisma.actionItem.findMany.mockResolvedValue([
      makeItem({ assignee: null, meeting: { participants: [] } }),
    ]);

    const result = await remindersService.run('test');

    expect(result.unresolved).toBe(1);
    expect(result.sent).toBe(0);
    expect(mockNotifier.send).not.toHaveBeenCalled();
    expect(mockPrisma.reminder.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
  });

  it('records FAILED and increments failed when notifier throws', async () => {
    mockPrisma.actionItem.findMany.mockResolvedValue([makeItem()]);
    mockNotifier.send.mockRejectedValue(new Error('Resend API error'));

    const result = await remindersService.run('test');

    expect(result.failed).toBe(1);
    expect(result.sent).toBe(0);
    expect(mockPrisma.reminder.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
  });

  it('one failed send does not abort the rest of the batch', async () => {
    mockPrisma.actionItem.findMany.mockResolvedValue([
      makeItem({ id: 'item-1', assignee: 'alice@example.com' }),
      makeItem({ id: 'item-2', assignee: 'bob@example.com' }),
    ]);
    mockNotifier.send
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(undefined);

    const result = await remindersService.run('test');

    expect(result.failed).toBe(1);
    expect(result.sent).toBe(1);
  });

  it('returns correct scanned count', async () => {
    mockPrisma.actionItem.findMany.mockResolvedValue([
      makeItem({ id: 'item-1' }),
      makeItem({ id: 'item-2', reminders: [{ id: 'r-1' }] }),
    ]);
    mockNotifier.send.mockResolvedValue(undefined);

    const result = await remindersService.run('test');

    expect(result.scanned).toBe(2);
    expect(result.sent).toBe(1);
    expect(result.skippedRecent).toBe(1);
  });
});
