import { z } from 'zod';

/**
 * A single transcript segment. `timestamp` is a human label (e.g. "00:10" or
 * "01:02:03") that doubles as the citation key, so it must be a non-empty string.
 */
export const transcriptSegmentSchema = z.object({
  timestamp: z
    .string()
    .min(1, 'timestamp is required')
    .regex(/^\d{1,2}:\d{2}(:\d{2})?$/, 'timestamp must look like MM:SS or HH:MM:SS'),
  speaker: z.string().min(1, 'speaker is required'),
  text: z.string().min(1, 'text is required'),
});

export const createMeetingSchema = z.object({
  title: z.string().min(1, 'Meeting title is required').max(200),
  participants: z
    .array(z.string().email('Each participant must be a valid email'))
    .min(1, 'At least one participant is required'),
  meetingDate: z
    .string()
    .datetime({ message: 'meetingDate must be an ISO-8601 datetime' }),
  transcript: z.array(transcriptSegmentSchema).min(1, 'Transcript must have at least one segment'),
});

export const listMeetingsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  q: z.string().trim().min(1).optional(),
  from: z.string().datetime({ message: 'from must be an ISO-8601 datetime' }).optional(),
  to: z.string().datetime({ message: 'to must be an ISO-8601 datetime' }).optional(),
});

export const meetingIdParamSchema = z.object({
  id: z.string().uuid('Meeting id must be a UUID'),
});

export type TranscriptSegment = z.infer<typeof transcriptSegmentSchema>;
export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;
export type ListMeetingsQuery = z.infer<typeof listMeetingsQuerySchema>;
