import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { meetingsApi, type Meeting, type TranscriptSegment } from '../lib/api';
import {
  Btn, Card, Empty, ErrorBox, Input, Modal, PageHeader, Spinner,
} from '../components/ui';

const SAMPLE_TRANSCRIPT: TranscriptSegment[] = [
  { timestamp: '00:00', speaker: 'Alice', text: 'Good morning everyone, shall we start?' },
  { timestamp: '00:30', speaker: 'Bob', text: 'Sure. I finished the auth module yesterday.' },
  { timestamp: '01:00', speaker: 'Alice', text: 'Great. Bob, can you also review the PR by Friday?' },
  { timestamp: '01:30', speaker: 'Charlie', text: 'I will handle the deployment pipeline.' },
  { timestamp: '02:00', speaker: 'Alice', text: 'Perfect. We decided to use Postgres for the database.' },
];

function NewMeetingModal({ onClose, onCreated }: { onClose: () => void; onCreated: (m: Meeting) => void }) {
  const [title, setTitle] = useState('');
  const [participants, setParticipants] = useState('alice@example.com, bob@example.com, charlie@example.com');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16));
  const [rawTranscript, setRawTranscript] = useState(
    SAMPLE_TRANSCRIPT.map((s) => `${s.timestamp} | ${s.speaker}: ${s.text}`).join('\n'),
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const parseTranscript = (): TranscriptSegment[] | null => {
    const lines = rawTranscript.split('\n').filter((l) => l.trim());
    const segments: TranscriptSegment[] = [];
    for (const line of lines) {
      const m = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s*\|\s*(.+?):\s*(.+)$/);
      if (!m) { setError(`Cannot parse line: "${line}"\nFormat: HH:MM | Speaker: text`); return null; }
      segments.push({ timestamp: m[1], speaker: m[2].trim(), text: m[3].trim() });
    }
    return segments;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const transcript = parseTranscript();
    if (!transcript) return;
    const parts = participants.split(',').map((p) => p.trim()).filter(Boolean);
    setLoading(true);
    try {
      const meeting = await meetingsApi.create({
        title,
        participants: parts,
        meetingDate: new Date(date).toISOString(),
        transcript,
      });
      onCreated(meeting);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="New Meeting" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Q2 Planning" required />
        <Input label="Participants (comma-separated emails)" value={participants} onChange={(e) => setParticipants(e.target.value)} required />
        <Input label="Meeting date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Transcript <span className="text-xs text-gray-400 font-normal">(format: HH:MM | Speaker: text)</span>
          </label>
          <textarea
            className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono"
            rows={8}
            value={rawTranscript}
            onChange={(e) => setRawTranscript(e.target.value)}
            required
          />
        </div>
        {error && <ErrorBox message={error} />}
        <div className="flex gap-2 justify-end">
          <Btn variant="secondary" type="button" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" disabled={loading}>{loading ? 'Creating…' : 'Create meeting'}</Btn>
        </div>
      </form>
    </Modal>
  );
}

export default function MeetingsPage() {
  const nav = useNavigate();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNew, setShowNew] = useState(false);

  const load = async (p: number, query: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await meetingsApi.list({ page: p, limit: 10, q: query || undefined });
      setMeetings(res.items);
      setMeta({ page: res.meta.page, totalPages: res.meta.totalPages });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(page, q); }, [page, q]);

  return (
    <div>
      <PageHeader
        title="Meetings"
        action={<Btn onClick={() => setShowNew(true)}>+ New Meeting</Btn>}
      />

      <div className="mb-4">
        <Input
          placeholder="Search by title…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          className="max-w-xs"
        />
      </div>

      {error && <ErrorBox message={error} />}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : meetings.length === 0 ? (
        <Empty text="No meetings yet. Create your first one!" />
      ) : (
        <div className="flex flex-col gap-3">
          {meetings.map((m) => (
            <Card
              key={m.id}
              className="p-4 cursor-pointer hover:border-violet-400 transition-colors"
              onClick={() => nav(`/meetings/${m.id}`)}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{m.title}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {new Date(m.meetingDate).toLocaleDateString(undefined, {
                      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{m.participants.join(', ')}</p>
                </div>
                <span className="text-xs text-gray-400 shrink-0">{m.transcript?.length ?? 0} segments</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {meta.totalPages > 1 && (
        <div className="flex items-center gap-2 mt-6 justify-center">
          <Btn variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</Btn>
          <span className="text-sm text-gray-500">{page} / {meta.totalPages}</span>
          <Btn variant="secondary" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next →</Btn>
        </div>
      )}

      {showNew && (
        <NewMeetingModal
          onClose={() => setShowNew(false)}
          onCreated={(m) => { setShowNew(false); nav(`/meetings/${m.id}`); }}
        />
      )}
    </div>
  );
}
