import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/errors';
import { buildPageMeta, parsePagination, type PageMeta } from '../../utils/pagination';
import type { CreateMeetingInput, ListMeetingsQuery, TranscriptSegment } from './meetings.schemas';

// Prisma requires InputJsonValue for Json columns. 
//  transcript is a validated array of { timestamp, speaker, text } objects.
// toJson - helper to avoid repeating the ugly (as unknown as Prisma.InputJsonValue) pattern everywhere. 
const toJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

export const meetingsService = {
  async create(userId: string, input: CreateMeetingInput) {
    return prisma.meeting.create({
      data: {
        userId,
        title: input.title,
        participants: input.participants,
        meetingDate: new Date(input.meetingDate),
        transcript: toJson(input.transcript),
      },
    });
  },

  /** Fetch a meeting owned by the user, or throw 404/403 appropriately. */
  async getOwned(userId: string, meetingId: string) {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { analysis: true },
    });
    if (!meeting) throw AppError.notFound('Meeting not found');
    if (meeting.userId !== userId) throw AppError.forbidden();
    return meeting;
  },

  async list(
    userId: string,
    query: ListMeetingsQuery,
  ): Promise<{ items: unknown[]; meta: PageMeta }> {
    const pagination = parsePagination(query);

    const where: Prisma.MeetingWhereInput = { userId };
    if (query.q) where.title = { contains: query.q, mode: 'insensitive' };
    if (query.from || query.to) {
      where.meetingDate = {};
      if (query.from) where.meetingDate.gte = new Date(query.from);
      if (query.to) where.meetingDate.lte = new Date(query.to);
    }

    const [items, total] = await Promise.all([
      prisma.meeting.findMany({
        where,
        orderBy: { meetingDate: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
        select: {
          id: true,
          title: true,
          participants: true,
          meetingDate: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { actionItems: true } },
        },
      }),
      prisma.meeting.count({ where }),
    ]);

    return { items, meta: buildPageMeta(total, pagination) };
  },

  // Helper used by the analysis module: returns the typed transcript. 
  getTranscript(meeting: { transcript: unknown }): TranscriptSegment[] {
    return (meeting.transcript as TranscriptSegment[]) ?? [];
  },
};
