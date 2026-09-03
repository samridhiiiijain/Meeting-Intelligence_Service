import { useEffect, useState } from 'react';
import { remindersApi, type ReminderHistoryEntry, type ReminderRunResult } from '../lib/api';
import { Badge, Btn, Card, Empty, ErrorBox, PageHeader, Spinner } from '../components/ui';

function RunResult({ result }: { result: ReminderRunResult }) {
  return (
    <Card className="p-4 mb-6 bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-700">
      <p className="text-sm font-medium text-violet-700 dark:text-violet-300 mb-2">Reminder run complete</p>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-center">
        {[
          { label: 'Scanned', value: result.scanned, color: 'text-gray-600 dark:text-gray-400' },
          { label: 'Sent', value: result.sent, color: 'text-green-600 dark:text-green-400' },
          { label: 'Failed', value: result.failed, color: 'text-red-500' },
          { label: 'Skipped', value: result.skippedRecent, color: 'text-yellow-600' },
          { label: 'Unresolved', value: result.unresolved, color: 'text-orange-500' },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function HistoryRow({ entry }: { entry: ReminderHistoryEntry }) {
  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-900 dark:text-gray-100 font-medium truncate">
            {entry.actionItem.task}
          </p>
          {entry.actionItem.assignee && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">→ {entry.actionItem.assignee}</p>
          )}
          <p className="text-xs text-gray-400 mt-0.5">
            To: {entry.recipient || '—'} · {new Date(entry.sentAt).toLocaleString()}
          </p>
          {entry.error && (
            <p className="text-xs text-red-500 mt-0.5 truncate">Error: {entry.error}</p>
          )}
        </div>
        <Badge
          label={entry.status}
          color={entry.status === 'SENT' ? 'green' : 'red'}
        />
      </div>
    </Card>
  );
}

export default function RemindersPage() {
  const [history, setHistory] = useState<ReminderHistoryEntry[]>([]);
  const [runResult, setRunResult] = useState<ReminderRunResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [runError, setRunError] = useState('');

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await remindersApi.history();
      setHistory(res.items ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadHistory(); }, []);

  const runReminders = async () => {
    setRunError('');
    setRunResult(null);
    setRunning(true);
    try {
      const res = await remindersApi.run();
      setRunResult(res);
      await loadHistory();
    } catch (err) {
      setRunError((err as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Reminders"
        action={
          <Btn onClick={runReminders} disabled={running}>
            {running ? <><Spinner size="sm" /><span className="ml-2">Running…</span></> : '▶ Run reminders'}
          </Btn>
        }
      />

      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Triggers the reminder job — finds all overdue action items and sends an email via Resend. The job also runs automatically every 15 minutes.
      </p>

      {runError && <div className="mb-4"><ErrorBox message={runError} /></div>}
      {runResult && <RunResult result={runResult} />}

      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">History</p>

      {error && <ErrorBox message={error} />}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : history.length === 0 ? (
        <Empty text="No reminders sent yet. Run the job or wait for the scheduler." />
      ) : (
        <div className="flex flex-col gap-2">
          {history.map((entry) => (
            <HistoryRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
