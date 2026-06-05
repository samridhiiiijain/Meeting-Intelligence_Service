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
  responses: { 201: jsonResponse('Created', success(z.any())), ...errorResponses },
});
registry.registerPath({
  method: 'post',
  path: '/api/auth/login',
  tags: ['Auth'],
  summary: 'Log in and receive a JWT',
  request: { body: jsonBody(loginSchema) },
  responses: { 200: jsonResponse('OK', success(z.any())), ...errorResponses },
});
registry.registerPath({
  method: 'get',
  path: '/api/auth/me',
  tags: ['Auth'],
  summary: 'Get the currently authenticated user',
  security: secured,
  responses: { 200: jsonResponse('OK', success(z.any())), ...errorResponses },
});

// ---- Meetings ----
registry.registerPath({
  method: 'post',
  path: '/api/meetings',
  tags: ['Meetings'],
  summary: 'Create a meeting with transcript',
  security: secured,
  request: { body: jsonBody(createMeetingSchema) },
  responses: { 201: jsonResponse('Created', success(z.any())), ...errorResponses },
});
registry.registerPath({
  method: 'get',
  path: '/api/meetings',
  tags: ['Meetings'],
  summary: 'List meetings (paginated, filterable)',
  security: secured,
  request: { query: listMeetingsQuerySchema },
  responses: { 200: jsonResponse('OK', success(z.any())), ...errorResponses },
});
registry.registerPath({
  method: 'get',
  path: '/api/meetings/{id}',
  tags: ['Meetings'],
  summary: 'Get a meeting by id',
  security: secured,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: jsonResponse('OK', success(z.any())), ...errorResponses },
});
registry.registerPath({
  method: 'post',
  path: '/api/meetings/{id}/analyze',
  tags: ['Analysis'],
  summary: 'Generate grounded, citation-backed insights for a meeting',
  security: secured,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: jsonResponse('OK', success(z.any())), ...errorResponses },
});

// ---- Action items ----
registry.registerPath({
  method: 'post',
  path: '/api/action-items',
  tags: ['Action Items'],
  summary: 'Create an action item',
  security: secured,
  request: { body: jsonBody(createActionItemSchema) },
  responses: { 201: jsonResponse('Created', success(z.any())), ...errorResponses },
});
registry.registerPath({
  method: 'get',
  path: '/api/action-items',
  tags: ['Action Items'],
  summary: 'List action items (filter by status/assignee/meetingId)',
  security: secured,
  request: { query: listActionItemsQuerySchema },
  responses: { 200: jsonResponse('OK', success(z.any())), ...errorResponses },
});
registry.registerPath({
  method: 'get',
  path: '/api/action-items/overdue',
  tags: ['Action Items'],
  summary: 'List overdue action items',
  security: secured,
  responses: { 200: jsonResponse('OK', success(z.any())), ...errorResponses },
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
  responses: { 200: jsonResponse('OK', success(z.any())), ...errorResponses },
});

// ---- Reminders ----
registry.registerPath({
  method: 'post',
  path: '/api/reminders/run',
  tags: ['Reminders'],
  summary: 'Manually trigger the reminder job (demo)',
  security: secured,
  responses: { 200: jsonResponse('OK', success(z.any())), ...errorResponses },
});
registry.registerPath({
  method: 'get',
  path: '/api/reminders/history',
  tags: ['Reminders'],
  summary: 'Recent reminder send history',
  security: secured,
  responses: { 200: jsonResponse('OK', success(z.any())), ...errorResponses },
});
registry.registerPath({
  method: 'get',
  path: '/api/internal/cron/reminders',
  tags: ['Reminders'],
  summary: 'External-scheduler trigger (requires x-cron-secret header)',
  request: {
    headers: z.object({ 'x-cron-secret': z.string() }),
  },
  responses: { 200: jsonResponse('OK', success(z.any())), 401: errorResponses[401] },
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
  responses: { 200: jsonResponse('OK', z.any()) },
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
