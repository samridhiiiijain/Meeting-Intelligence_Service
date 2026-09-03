import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { meetingsApi, type AnalysisResult, type Meeting, type TranscriptSegment } from '../lib/api';
import { Badge, Btn, Card, Empty, ErrorBox, PageHeader, Spinner } from '../components/ui';

// Highlight a transcript segment when a citation chip is clicked
function TranscriptView({
  segments,
  highlighted,
}: {
  segments: TranscriptSegment[];
  highlighted: string | null;
}) {
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (highlighted && refs.current[highlighted]) {
      refs.current[highlighted]!.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlighted]);

  return (
    <div className="flex flex-col gap-1 max-h-96 overflow-y-auto pr-1">
      {segments.map((seg) => (
        <div
          key={seg.timestamp}
          ref={(el) => { refs.current[seg.timestamp] = el; }}
          className={`px-3 py-2 rounded-lg text-sm transition-colors ${
            highlighted === seg.timestamp
              ? 'bg-violet-100 dark:bg-violet-900/40 border border-violet-400'
              : 'bg-gray-50 dark:bg-gray-700/40'
          }`}
        >
          <span className="font-mono text-xs text-violet-500 mr-2">[{seg.timestamp}]</span>
          <span className="font-medium text-gray-700 dark:text-gray-200">{seg.speaker}:</span>
          <span className="text-gray-600 dark:text-gray-300 ml-1">{seg.text}</span>
        </div>
      ))}
    </div>
  );
}

// Clickable citation chip
function CitationChip({
  timestamp,
  onClick,
  active,
}: {
  timestamp: string;
  onClick: (ts: string) => void;
  active: boolean;
}) {
  return (
    <button
      onClick={() => onClick(timestamp)}
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium transition-colors border ${
        active
          ? 'bg-violet-600 text-white border-violet-600'
          : 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700'
      }`}
    >
      {timestamp}
    </button>
  );
}

function AnalysisView({
  result,
  segments,
}: {
  result: AnalysisResult;
  segments: TranscriptSegment[];
}) {
  const [highlighted, setHighlighted] = useState<string | null>(null);

  const cite = (ts: string) => setHighlighted((prev) => (prev === ts ? null : ts));

  const renderCitations = (citations: { timestamp: string }[]) =>
    citations.map((c) => (
      <CitationChip
        key={c.timestamp}
        timestamp={c.timestamp}
        active={highlighted === c.timestamp}
        onClick={cite}
      />
    ));

  const { grounding: g } = result;

  return (
    <div className="flex flex-col gap-6">
      {/* Grounding stats */}
      <Card className="p-4">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Grounding Report</p>
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="text-green-600 dark:text-green-400 font-medium">✓ {g.keptItems} kept</span>
          {g.droppedItems > 0 && <span className="text-red-500 font-medium">✗ {g.droppedItems} dropped</span>}
          {g.removedCitations > 0 && <span className="text-orange-500">−{g.removedCitations} citations removed</span>}
          {g.flaggedAssignees > 0 && <span className="text-yellow-600">{g.flaggedAssignees} assignees nulled</span>}
          <span className="text-gray-400 text-xs">model: {result.model}</span>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: transcript */}
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
            Transcript <span className="normal-case font-normal">(click a citation to highlight)</span>
          </p>
          <TranscriptView segments={segments} highlighted={highlighted} />
        </div>

        {/* Right: insights */}
        <div className="flex flex-col gap-4">
          {result.summary.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Summary</p>
              <ul className="flex flex-col gap-2">
                {result.summary.map((s, i) => (
                  <li key={i} className="bg-gray-50 dark:bg-gray-700/40 rounded-lg px-3 py-2 text-sm">
                    <p className="text-gray-800 dark:text-gray-200">{s.text}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">{renderCitations(s.citations)}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.actionItems.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Action Items</p>
              <ul className="flex flex-col gap-2">
                {result.actionItems.map((a, i) => (
                  <li key={i} className="bg-gray-50 dark:bg-gray-700/40 rounded-lg px-3 py-2 text-sm">
                    <p className="text-gray-800 dark:text-gray-200">{a.task}</p>
                    {a.assignee && <p className="text-xs text-violet-600 dark:text-violet-400 mt-0.5">→ {a.assignee}</p>}
                    <div className="flex flex-wrap gap-1 mt-1.5">{renderCitations(a.citations)}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.decisions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Decisions</p>
              <ul className="flex flex-col gap-2">
                {result.decisions.map((d, i) => (
                  <li key={i} className="bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2 text-sm">
                    <p className="text-gray-800 dark:text-gray-200">{d.text}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">{renderCitations(d.citations)}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.followUps.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Follow-ups</p>
              <ul className="flex flex-col gap-2">
                {result.followUps.map((f, i) => (
                  <li key={i} className="bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2 text-sm">
                    <p className="text-gray-800 dark:text-gray-200">{f.text}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">{renderCitations(f.citations)}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loadingMeeting, setLoadingMeeting] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [analyzeError, setAnalyzeError] = useState('');

  useEffect(() => {
    if (!id) return;
    meetingsApi
      .get(id)
      .then(setMeeting)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoadingMeeting(false));
  }, [id]);

  const runAnalysis = async () => {
    if (!id) return;
    setAnalyzeError('');
    setAnalyzing(true);
    try {
      const res = await meetingsApi.analyze(id);
      setAnalysis(res);
      // refresh meeting to get latest transcript if needed
      const updated = await meetingsApi.get(id);
      setMeeting(updated);
    } catch (err) {
      setAnalyzeError((err as Error).message);
    } finally {
      setAnalyzing(false);
    }
  };

  if (loadingMeeting) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }
  if (error) return <ErrorBox message={error} />;
  if (!meeting) return null;

  return (
    <div>
      <div className="mb-2">
        <Link to="/meetings" className="text-sm text-violet-600 hover:underline">← Meetings</Link>
      </div>
      <PageHeader
        title={meeting.title}
        action={
          <Btn onClick={runAnalysis} disabled={analyzing}>
            {analyzing ? <><Spinner size="sm" /><span className="ml-2">Analyzing…</span></> : '✦ Analyze'}
          </Btn>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4 text-sm text-gray-500 dark:text-gray-400">
        <span>
          {new Date(meeting.meetingDate).toLocaleDateString(undefined, {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
        </span>
        <span>·</span>
        <span>{(meeting.participants ?? []).join(', ')}</span>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {(meeting.participants ?? []).map((p) => (
          <Badge key={p} label={p} color="violet" />
        ))}
      </div>

      {analyzeError && <div className="mb-4"><ErrorBox message={analyzeError} /></div>}

      {analysis ? (
        <AnalysisView result={analysis} segments={meeting.transcript ?? []} />
      ) : (
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Transcript</p>
          <Card className="p-4">
            {(meeting.transcript?.length ?? 0) === 0 ? (
              <Empty text="No transcript segments." />
            ) : (
              <div className="flex flex-col gap-1 max-h-96 overflow-y-auto">
                {(meeting.transcript ?? []).map((seg) => (
                  <div key={seg.timestamp} className="px-3 py-2 rounded-lg text-sm bg-gray-50 dark:bg-gray-700/40">
                    <span className="font-mono text-xs text-violet-500 mr-2">[{seg.timestamp}]</span>
                    <span className="font-medium text-gray-700 dark:text-gray-200">{seg.speaker}:</span>
                    <span className="text-gray-600 dark:text-gray-300 ml-1">{seg.text}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <p className="text-sm text-gray-400 mt-4 text-center">
            Click <strong>✦ Analyze</strong> to generate grounded AI insights with citations.
          </p>
        </div>
      )}
    </div>
  );
}
