const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

// ---------- token storage ----------
const TOKEN_KEY = 'hintro_token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// ---------- core request ----------
async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const json = await res.json();

  if (!json.success) {
    const msg =
      json.error?.message ??
      json.error?.details?.map((d: { message: string }) => d.message).join(', ') ??
      'Request failed';
    throw new Error(msg);
  }

  return json.data as T;
}

const get = <T>(p: string, params?: Record<string, string | number | undefined>) =>
  request<T>('GET', p, undefined, params);
const post = <T>(p: string, body?: unknown) => request<T>('POST', p, body);
const patch = <T>(p: string, body?: unknown) => request<T>('PATCH', p, body);

// ---------- types ----------
export interface User {
  id: string;
  email: string;
  name: string;
}

export interface TranscriptSegment {
  timestamp: string;
  speaker: string;
  text: string;
}

export interface Meeting {
  id: string;
  title: string;
  participants: string[];
  meetingDate: string;
  transcript: TranscriptSegment[];
  createdAt: string;
}

export interface MeetingListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface MeetingListResponse {
  items: Meeting[];
  meta: MeetingListMeta;
}

export interface Citation {
  timestamp: string;
}

export interface SummaryPoint {
  text: string;
  citations: Citation[];
}

export interface ActionItemAI {
  task: string;
  assignee: string | null;
  citations: Citation[];
}

export interface Decision {
  text: string;
  citations: Citation[];
}

export interface FollowUp {
  text: string;
  citations: Citation[];
}

export interface Grounding {
  totalItems: number;
  keptItems: number;
  droppedItems: number;
  removedCitations: number;
  flaggedAssignees: number;
}

export interface AnalysisResult {
  meetingId: string;
  model: string;
  summary: SummaryPoint[];
  actionItems: ActionItemAI[];
  decisions: Decision[];
  followUps: FollowUp[];
  grounding: Grounding;
}

export type ActionItemStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export interface ActionItem {
  id: string;
  meetingId: string | null;
  userId: string;
  task: string;
  assignee: string | null;
  status: ActionItemStatus;
  dueDate: string | null;
  source: 'AI' | 'MANUAL';
  citations: Citation[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActionItemListResponse {
  items: ActionItem[];
  meta: MeetingListMeta;
}

export interface ReminderRunResult {
  triggeredBy: string;
  scanned: number;
  sent: number;
  failed: number;
  skippedRecent: number;
  unresolved: number;
}

export interface ReminderHistoryEntry {
  id: string;
  actionItemId: string;
  channel: string;
  recipient: string;
  status: 'SENT' | 'FAILED';
  message: string;
  error: string | null;
  sentAt: string;
  actionItem: { id: string; task: string; assignee: string | null };
}

// ---------- auth ----------
export const authApi = {
  register: (body: { name: string; email: string; password: string }) =>
    post<{ token: string; user: User }>('/api/auth/register', body),
  login: (body: { email: string; password: string }) =>
    post<{ token: string; user: User }>('/api/auth/login', body),
  me: () => get<User>('/api/auth/me'),
};

// ---------- meetings ----------
export const meetingsApi = {
  list: (params?: { page?: number; limit?: number; q?: string; from?: string; to?: string }) =>
    get<MeetingListResponse>('/api/meetings', params as Record<string, string | number | undefined>),
  get: (id: string) => get<Meeting>(`/api/meetings/${id}`),
  create: (body: {
    title: string;
    participants: string[];
    meetingDate: string;
    transcript: TranscriptSegment[];
  }) => post<Meeting>('/api/meetings', body),
  analyze: (id: string) => post<AnalysisResult>(`/api/meetings/${id}/analyze`),
};

// ---------- action items ----------
export const actionItemsApi = {
  list: (params?: {
    status?: string;
    assignee?: string;
    meetingId?: string;
    page?: number;
    limit?: number;
  }) =>
    get<ActionItemListResponse>(
      '/api/action-items',
      params as Record<string, string | number | undefined>,
    ),
  overdue: () => get<ActionItemListResponse>('/api/action-items/overdue'),
  create: (body: {
    task: string;
    meetingId?: string;
    assignee?: string;
    status?: ActionItemStatus;
    dueDate?: string;
  }) => post<ActionItem>('/api/action-items', body),
  updateStatus: (id: string, status: ActionItemStatus) =>
    patch<ActionItem>(`/api/action-items/${id}/status`, { status }),
};

// ---------- reminders ----------
export const remindersApi = {
  run: () => post<ReminderRunResult>('/api/reminders/run'),
  history: () => get<{ items: ReminderHistoryEntry[]; meta: MeetingListMeta }>('/api/reminders/history'),
};
