import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

/**
 * Seed a demo user + a sample meeting (the assignment's example payload) so the
 * deployed API can be explored immediately. Idempotent: safe to re-run.
 *
 * Demo login: demo@hintro.test / Password123
 */
const prisma = new PrismaClient();

async function main() {
  const email = 'demo@hintro.test';
  const passwordHash = await bcrypt.hash('Password123', 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, name: 'Demo User' },
  });

  const existing = await prisma.meeting.findFirst({
    where: { userId: user.id, title: 'Sprint Planning' },
  });

  if (!existing) {
    const pastDue = new Date(Date.now() - 3 * 24 * 3600 * 1000); // overdue for demo
    const meeting = await prisma.meeting.create({
      data: {
        userId: user.id,
        title: 'Sprint Planning',
        participants: ['alice@example.com', 'bob@example.com'],
        meetingDate: new Date('2026-05-20T10:00:00Z'),
        transcript: [
          { timestamp: '00:10', speaker: 'John', text: 'We should launch next Friday.' },
          { timestamp: '00:20', speaker: 'Alice', text: 'I will prepare release notes.' },
        ],
      },
    });

    await prisma.actionItem.create({
      data: {
        userId: user.id,
        meetingId: meeting.id,
        task: 'Prepare release notes',
        assignee: 'Alice',
        status: 'PENDING',
        dueDate: pastDue,
        source: 'MANUAL',
        citations: [{ timestamp: '00:20' }],
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log(`Seeded demo user: ${email} / Password123`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
