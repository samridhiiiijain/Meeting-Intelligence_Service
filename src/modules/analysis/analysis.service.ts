import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { getLLMProvider } from '../../lib/llm';
import { AppError } from '../../utils/errors';
import { meetingsService } from '../meetings/meetings.service';
import { validateGrounding, type GroundedAnalysis } from './citationValidator';

// Prisma requires InputJsonValue for Json columns. This cast is safe because
// the values are plain serialisable objects validated by the citation validator.
const toJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

export const analysisService = {
  /**
   * Analyze a meeting transcript end-to-end:
   *  1. load the user's meeting + transcript,
   *  2. call the LLM provider for structured insights,
   *  3. enforce grounding (drop unsupported items / invented attendees),
   *  4. persist the Analysis and sync AI-extracted action items,
   *  5. return the grounded result in the assignment's response shape.
   */
  async analyzeMeeting(userId: string, meetingId: string) {
    const meeting = await meetingsService.getOwned(userId, meetingId);
    const transcript = meetingsService.getTranscript(meeting);

    if (transcript.length === 0) {
      throw AppError.badRequest('Meeting has no transcript to analyze');
    }

    const provider = getLLMProvider();
    const raw = await provider.analyzeTranscript({
      title: meeting.title,
      participants: meeting.participants,
      transcript,
    });

    const grounded = validateGrounding(raw, transcript, meeting.participants);

    await this.persist(meetingId, userId, grounded, provider.model);

    return {
      meetingId,
      model: provider.model,
      summary: grounded.summary,
      actionItems: grounded.actionItems,
      decisions: grounded.decisions,
      followUps: grounded.followUps,
      grounding: grounded.grounding,
    };
  },

  /** Upsert the Analysis row and rebuild AI-sourced action items idempotently. */
  async persist(meetingId: string, userId: string, grounded: GroundedAnalysis, model: string) {
    const summary   = toJson(grounded.summary);
    const decisions = toJson(grounded.decisions);
    const followUps = toJson(grounded.followUps);

    await prisma.$transaction(async (tx) => {
      // createdAt is updated on re-analysis so the timestamp reflects the latest run.
      await tx.analysis.upsert({
        where: { meetingId },
        create: { meetingId, summary, decisions, followUps, model },
        update: { summary, decisions, followUps, model, createdAt: new Date() },
      });

      // Re-analysis replaces previously AI-generated items; manual items are kept.
      await tx.actionItem.deleteMany({ where: { meetingId, source: 'AI' } });

      if (grounded.actionItems.length > 0) {
        await tx.actionItem.createMany({
          data: grounded.actionItems.map((ai) => ({
            meetingId,
            userId,
            task: ai.task,
            assignee: ai.assignee,
            source: 'AI' as const,
            citations: toJson(ai.citations),
          })),
        });
      }
    });
  },
};
