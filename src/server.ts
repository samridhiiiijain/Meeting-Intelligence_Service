import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { startReminderScheduler, stopReminderScheduler } from './modules/reminders/scheduler';

/** Bootstrap: start the HTTP server and the in-process reminder scheduler. */
async function main() {
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV, docs: `http://localhost:${env.PORT}/docs` },
      'Meeting Intelligence Service started',
    );
  });

  startReminderScheduler();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down...');
    stopReminderScheduler();
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  // Last-resort safety nets so an unexpected error never silently kills the app.
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection');
  });
  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'Uncaught exception');
  });
}

void main();
