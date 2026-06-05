import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/errors';
import { buildPageMeta, parsePagination, type PageMeta } from '../../utils/pagination';
import type { CreateActionItemInput, ListActionItemsQuery } from './actionItems.schemas';

/**
 * The single source of truth for "overdue": not completed AND has a due date in
 * the past. Reused by the /overdue endpoint and the reminder job so the two can
 * never drift apart.
 */
export function overdueWhere(now: Date = new Date()): Prisma.ActionItemWhereInput {
  return {
    status: { not: 'COMPLETED' },
    dueDate: { not: null, lt: now },
  };
}

export const actionItemsService = {
  async create(userId: string, input: CreateActionItemInput) {
    if (input.meetingId) {
      // Ensure the referenced meeting exists and belongs to the user.
      const meeting = await prisma.meeting.findUnique({ where: { id: input.meetingId } });
      if (!meeting) throw AppError.notFound('Meeting not found');
      if (meeting.userId !== userId) throw AppError.forbidden();
    }

    return prisma.actionItem.create({
      data: {
        userId,
        meetingId: input.meetingId ?? null,
        task: input.task,
        assignee: input.assignee ?? null,
        status: input.status ?? 'PENDING',
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        source: 'MANUAL',
      },
    });
  },

  async getOwned(userId: string, id: string) {
    const item = await prisma.actionItem.findUnique({ where: { id } });
    if (!item) throw AppError.notFound('Action item not found');
    if (item.userId !== userId) throw AppError.forbidden();
    return item;
  },

  async updateStatus(userId: string, id: string, status: CreateActionItemInput['status']) {
    await this.getOwned(userId, id);
    return prisma.actionItem.update({ where: { id }, data: { status } });
  },

  async list(
    userId: string,
    query: ListActionItemsQuery,
  ): Promise<{ items: unknown[]; meta: PageMeta }> {
    const pagination = parsePagination(query);
    const where: Prisma.ActionItemWhereInput = { userId };
    if (query.status) where.status = query.status;
    if (query.assignee) where.assignee = { equals: query.assignee, mode: 'insensitive' };
    if (query.meetingId) where.meetingId = query.meetingId;

    const [items, total] = await Promise.all([
      prisma.actionItem.findMany({
        where,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.actionItem.count({ where }),
    ]);

    return { items, meta: buildPageMeta(total, pagination) };
  },

  async listOverdue(
    userId: string,
    query: { page?: number; limit?: number } = {},
  ): Promise<{ items: unknown[]; meta: PageMeta }> {
    const pagination = parsePagination(query);
    const where: Prisma.ActionItemWhereInput = { userId, ...overdueWhere() };

    const [items, total] = await Promise.all([
      prisma.actionItem.findMany({
        where,
        orderBy: { dueDate: 'asc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.actionItem.count({ where }),
    ]);

    return { items, meta: buildPageMeta(total, pagination) };
  },
};
