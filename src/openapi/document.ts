import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { env } from '../config/env';
import { loginSchema, registerSchema } from '../modules/auth/auth.schemas';
import {
  createMeetingSchema,
  listMeetingsQuerySchema,
} from '../modules/meetings/meetings.schemas';
import {
  createActionItemSchema,
  listActionItemsQuerySchema,
  updateStatusSchema,
} from '../modules/actionItems/actionItems.schemas';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

// ---- Reusable response shapes ----

const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  createdAt: z.string().datetime(),
});

const authResponseSchema = z.object({
  user: userSchema,
  token: z.string(),
});

const transcriptSegmentSchema = z.object({
  timestamp: z.string(),
  speaker: z.string(),
  text: z.string(),
});

const meetingSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  participants: z.array(z.string()),
  meetingDate: z.string().datetime(),
  transcript: z.array(transcriptSegmentSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const meetingListItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  participants: z.array(z.string()),
  meetingDate: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  _count: z.object({ actionItems: z.number() }),
});

const paginatedSchema = (itemSchema: z.ZodTypeAny) =>
  z.object({
    items: z.array(itemSchema),
    meta: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      totalPages: z.number(),
    }),
  });

const citationSchema = z.object({ timestamp: z.string() });

const analysisResponseSchema = z.object({
  meetingId: z.string().uuid(),
  model: z.string(),
  summary:     z.array(z.object({ text: z.string(), citations: z.array(citationSchema) })),
  actionItems: z.array(z.object({ task: z.string(), assignee: z.string().nullable(), dueDate: z.string().nullable(), citations: z.array(citationSchema) })),
  decisions:   z.array(z.object({ text: z.string(), citations: z.array(citationSchema) })),
  followUps:   z.array(z.object({ text: z.string(), citations: z.array(citationSchema) })),
  grounding: z.object({
    totalItems: z.number(),
    keptItems: z.number(),
    droppedItems: z.number(),
    removedCitations: z.number(),
    flaggedAssignees: z.number(),
  }),
});

const actionItemSchema = z.object({
  id: z.string().uuid(),
  meetingId: z.string().uuid().nullable(),
  userId: z.string().uuid(),
  task: z.string(),
  assignee: z.string().nullable(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']),
  dueDate: z.string().datetime().nullable(),
  source: z.enum(['AI', 'MANUAL']),
  citations: z.array(citationSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const reminderRunSchema = z.object({
  sent: z.number(),
  skipped: z.number(),
  failed: z.number(),
});

const reminderHistoryItemSchema = z.object({
  id: z.string().uuid(),
  actionItemId: z.string().uuid(),
  channel: z.string(),
  recipient: z.string(),
  status: z.enum(['SENT', 'FAILED']),
  message: z.string(),
  error: z.string().nullable(),
  sentAt: z.string().datetime(),
});

const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

/** Generic success/error envelope helpers for documentation. */
function success(dataSchema: z.ZodTypeAny) {
  return z.object({ traceId: z.string(), success: z.literal(true), data: dataSchema });
}
const errorEnvelope = z.object({
  traceId: z.string(),
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

const jsonBody = (schema: z.ZodTypeAny) => ({
  content: { 'application/json': { schema } },
});
const jsonResponse = (description: string, schema: z.ZodTypeAny) => ({
  description,
  content: { 'application/json': { schema } },
});

const errorResponses = {
  400: jsonResponse('Validation error', errorEnvelope),
  401: jsonResponse('Unauthorized', errorEnvelope),
  404: jsonResponse('Not found', errorEnvelope),
};

const secured = [{ [bearerAuth.name]: [] }];

// ---- Auth ----
registry.registerPath({
  method: 'post',
  path: '/api/auth/register',
  tags: ['Auth'],
  summary: 'Register a new user and receive a JWT',
  request: { body: jsonBody(registerSchema) },
  responses: { 201: jsonResponse('Created', success(authResponseSchema)), ...errorResponses },
});
registry.registerPath({
  method: 'post',
  path: '/api/auth/login',
  tags: ['Auth'],
  summary: 'Log in and receive a JWT',
  request: { body: jsonBody(loginSchema) },
  responses: { 200: jsonResponse('OK', success(authResponseSchema)), ...errorResponses },
});
registry.registerPath({
  method: 'get',
  path: '/api/auth/me',
  tags: ['Auth'],
  summary: 'Get the currently authenticated user',
  security: secured,
  responses: { 200: jsonResponse('OK', success(userSchema)), ...errorResponses },
});

// ---- Meetings ----
registry.registerPath({
  method: 'post',
  path: '/api/meetings',
  tags: ['Meetings'],
  summary: 'Create a meeting with transcript',
  security: secured,
  request: { body: jsonBody(createMeetingSchema) },
  responses: { 201: jsonResponse('Created', success(meetingSchema)), ...errorResponses },
});
registry.registerPath({
  method: 'get',
  path: '/api/meetings',
  tags: ['Meetings'],
  summary: 'List meetings (paginated, filterable)',
  security: secured,
  request: { query: listMeetingsQuerySchema },
  responses: { 200: jsonResponse('OK', success(paginatedSchema(meetingListItemSchema))), ...errorResponses },
});
registry.registerPath({
  method: 'get',
  path: '/api/meetings/{id}',
  tags: ['Meetings'],
  summary: 'Get a meeting by id',
  security: secured,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: jsonResponse('OK', success(meetingSchema)), ...errorResponses },
});
registry.registerPath({
  method: 'post',
  path: '/api/meetings/{id}/analyze',
  tags: ['Analysis'],
  summary: 'Generate grounded, citation-backed insights for a meeting',
  security: secured,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: jsonResponse('OK', success(analysisResponseSchema)), ...errorResponses },
});

// ---- Action items ----
registry.registerPath({
  method: 'post',
  path: '/api/action-items',
  tags: ['Action Items'],
  summary: 'Create an action item',
  security: secured,
  request: { body: jsonBody(createActionItemSchema) },
  responses: { 201: jsonResponse('Created', success(actionItemSchema)), ...errorResponses },
});
registry.registerPath({
  method: 'get',
  path: '/api/action-items',
  tags: ['Action Items'],
  summary: 'List action items (filter by status/assignee/meetingId)',
  security: secured,
  request: { query: listActionItemsQuerySchema },
  responses: { 200: jsonResponse('OK', success(paginatedSchema(actionItemSchema))), ...errorResponses },
});
registry.registerPath({
  method: 'get',
  path: '/api/action-items/overdue',
  tags: ['Action Items'],
  summary: 'List overdue action items',
  security: secured,
  responses: { 200: jsonResponse('OK', success(paginatedSchema(actionItemSchema))), ...errorResponses },
});
registry.registerPath({
  method: 'patch',
  path: '/api/action-items/{id}/status',
  tags: ['Action Items'],
  summary: 'Update action item status',
  security: secured,
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: jsonBody(updateStatusSchema),
  },
  responses: { 200: jsonResponse('OK', success(actionItemSchema)), ...errorResponses },
});

// ---- Reminders ----
registry.registerPath({
  method: 'post',
  path: '/api/reminders/run',
  tags: ['Reminders'],
  summary: 'Manually trigger the reminder job (demo)',
  security: secured,
  responses: { 200: jsonResponse('OK', success(reminderRunSchema)), ...errorResponses },
});
registry.registerPath({
  method: 'get',
  path: '/api/reminders/history',
  tags: ['Reminders'],
  summary: 'Recent reminder send history',
  security: secured,
  responses: { 200: jsonResponse('OK', success(paginatedSchema(reminderHistoryItemSchema))), ...errorResponses },
});
registry.registerPath({
  method: 'get',
  path: '/api/internal/cron/reminders',
  tags: ['Reminders'],
  summary: 'External-scheduler trigger (requires x-cron-secret header)',
  request: {
    headers: z.object({ 'x-cron-secret': z.string() }),
  },
  responses: {
    200: jsonResponse('OK', success(reminderRunSchema)),
    401: errorResponses[401],
    500: jsonResponse('Internal error', errorEnvelope),
  },
});

// ---- Platform ----
registry.registerPath({
  method: 'get',
  path: '/health',
  tags: ['Platform'],
  summary: 'Liveness probe',
  responses: { 200: jsonResponse('Service is up', z.object({ status: z.literal('UP') })) },
});
registry.registerPath({
  method: 'get',
  path: '/api/evaluation',
  tags: ['Platform'],
  summary: 'Evaluation metadata',
  responses: {
    200: jsonResponse('OK', z.object({
      candidateName: z.string(),
      candidateEmail: z.string(),
      repositoryUrl: z.string(),
      deployedUrl: z.string(),
      externalIntegration: z.string(),
      features: z.array(z.string()),
    })),
  },
});

/** Build the OpenAPI 3.0 document consumed by Swagger UI and /openapi.json. */
export function buildOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      title: 'Meeting Intelligence Service API',
      version: '1.0.0',
      description:
        'AI-powered meeting intelligence: meetings, grounded citation-backed analysis, ' +
        'action items, overdue detection, and scheduled email reminders. ' +
        'All endpoints (except /health and /api/evaluation) return a unified envelope ' +
        '`{ traceId, success, data | error }`.',
    },
    servers: [{ url: env.DEPLOYED_URL || `http://localhost:${env.PORT}` }],
  });
}
