import 'dotenv/config';
import { z } from 'zod';

/**
 * Centralized, validated environment configuration.
 *
 * The whole app reads config from this single module so that:
 *  - missing/invalid env vars fail fast at boot (not deep inside a request),
 *  - every value is typed, and
 *  - tests can import the same parsed shape.
 */
const booleanish = z
  .string()
  .optional()
  .transform((v) => v === undefined || v.toLowerCase() === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  CORS_ORIGIN: z.string().default('*'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('1d'),

  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),

  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().default('Hintro Reminders <onboarding@resend.dev>'),
  REMINDER_TO_OVERRIDE: z.string().optional(),

  REMINDER_CRON: z.string().default('*/15 * * * *'),
  REMINDER_CRON_ENABLED: booleanish,
  REMINDER_DEDUPE_HOURS: z.coerce.number().nonnegative().default(24),
  CRON_SECRET: z.string().optional(),

  CANDIDATE_NAME: z.string().default('Candidate'),
  CANDIDATE_EMAIL: z.string().default('candidate@example.com'),
  REPOSITORY_URL: z.string().default(''),
  DEPLOYED_URL: z.string().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast with a readable message — never boot a half-configured server.
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
  // eslint-disable-next-line no-console
  console.error(`❌ Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

export const env = parsed.data;

export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
