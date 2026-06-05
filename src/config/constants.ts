/** Application-wide constants. */

export const TRACE_HEADER = 'x-trace-id';
export const REQUEST_ID_HEADER = 'x-request-id';
export const CRON_SECRET_HEADER = 'x-cron-secret';

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const EXTERNAL_INTEGRATION_NAME = 'Resend (Email)';

/** Feature labels surfaced by GET /api/evaluation. */
export const FEATURES = [
  'Authentication (JWT)',
  'Meeting Management',
  'AI Meeting Analysis',
  'Grounded Insights with Citations',
  'Action Item Management',
  'Overdue Detection',
  'Scheduled Reminder Job',
  'Resend Email Integration',
  'Unified API Response + Trace IDs',
  'Structured Logging',
  'OpenAPI / Swagger Docs',
] as const;
