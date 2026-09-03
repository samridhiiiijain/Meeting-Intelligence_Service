import { useEffect, useState } from 'react';
import { actionItemsApi, type ActionItem, type ActionItemStatus } from '../lib/api';
import { Badge, Btn, Card, Empty, ErrorBox, Modal, Input, Select, PageHeader, Spinner } from '../components/ui';

const STATUS_COLORS: Record<ActionItemStatus, 'yellow' | 'blue' | 'green'> = {
  PENDING: 'yellow',
  IN_PROGRESS: 'blue',
  COMPLETED: 'green',
};

function statusLabel(s: ActionItemStatus) {
  return s === 'IN_PROGRESS' ? 'In Progress' : s[0] + s.slice(1).toLowerCase();
}

function NewItemModal({ onClose, onCreated }: { onClose: () => void; onCreated: (item: ActionItem) => void }) {
  const [task, setTask] = useState('');
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const item = await actionItemsApi.create({
        task,
        assignee: assignee || undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      });
      onCreated(item);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="New Action Item" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Input label="Task" value={task} onChange={(e) => setTask(e.target.value)} placeholder="Write the deployment guide" required />
        <Input label="Assignee (name or email)" value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="alice@example.com" />
        <Input label="Due date" type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        {error && <ErrorBox message={error} />}
        <div className="flex gap-2 justify-end">
          <Btn variant="secondary" type="button" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" disabled={loading}>{loading ? 'Creating…' : 'Create'}</Btn>
        </div>
      </form>
    </Modal>
  );
}

function ItemCard({
  item,
  onStatusChange,
}: {
  item: ActionItem;
  onStatusChange: (id: string, s: ActionItemStatus) => void;
}) {
  const [updating, setUpdating] = useState(false);
  const isOverdue =
    item.dueDate &&
    item.status !== 'COMPLETED' &&
    new Date(item.dueDate) < new Date();

  const next = (current: ActionItemStatus): ActionItemStatus | null => {
    if (current === 'PENDING') return 'IN_PROGRESS';
    if (current === 'IN_PROGRESS') return 'COMPLETED';
    return null;
  };

  const advance = async () => {
    const n = next(item.status);
    if (!n) return;
    setUpdating(true);
    try {
      await actionItemsApi.updateStatus(item.id, n);
      onStatusChange(item.id, n);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Card className={`p-4 ${isOverdue ? 'border-red-300 dark:border-red-700' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-sm font-medium ${item.status === 'COMPLETED' ? 'line-through text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
              {item.task}
            </p>
            <Badge label={statusLabel(item.status)} color={STATUS_COLORS[item.status]} />
            {item.source === 'AI' && <Badge label="AI" color="violet" />}
            {isOverdue && <Badge label="Overdue" color="red" />}
          </div>
          {item.assignee && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">→ {item.assignee}</p>
          )}
          {item.dueDate && (
            <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
              Due: {new Date(item.dueDate).toLocaleDateString()}
            </p>
          )}
          {item.citations && item.citations.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {item.citations.map((c) => (
                <span key={c.timestamp} className="text-xs font-mono bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 px-1.5 py-0.5 rounded">
                  {c.timestamp}
                </span>
              ))}
            </div>
          )}
        </div>
        {next(item.status) && (
          <Btn variant="ghost" size="sm" onClick={advance} disabled={updating}>
            {updating ? '…' : next(item.status) === 'IN_PROGRESS' ? '▶ Start' : '✓ Done'}
          </Btn>
        )}
      </div>
    </Card>
  );
}

export default function ActionItemsPage() {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showOverdue, setShowOverdue] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      if (showOverdue) {
        const res = await actionItemsApi.overdue();
        setItems(res.items ?? (res as unknown as ActionItem[]));
      } else {
        const res = await actionItemsApi.list({
          status: statusFilter || undefined,
          assignee: assigneeFilter || undefined,
        });
        setItems(res.items);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [showOverdue, statusFilter, assigneeFilter]);

  const handleStatusChange = (id: string, newStatus: ActionItemStatus) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item)));
  };

  return (
    <div>
      <PageHeader
        title="Action Items"
        action={<Btn onClick={() => setShowNew(true)}>+ New Item</Btn>}
      />

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-sm">
          <button
            onClick={() => setShowOverdue(false)}
            className={`px-3 py-1.5 ${!showOverdue ? 'bg-violet-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
            All
          </button>
          <button
            onClick={() => setShowOverdue(true)}
            className={`px-3 py-1.5 ${showOverdue ? 'bg-red-500 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
            Overdue
          </button>
        </div>

        {!showOverdue && (
          <>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
            </Select>
            <Input
              placeholder="Filter by assignee…"
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="w-44"
            />
          </>
        )}
      </div>

      {error && <ErrorBox message={error} />}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : items.length === 0 ? (
        <Empty text={showOverdue ? 'No overdue items. Great job!' : 'No action items yet.'} />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}

      {showNew && (
        <NewItemModal
          onClose={() => setShowNew(false)}
          onCreated={(item) => { setShowNew(false); setItems((prev) => [item, ...prev]); }}
        />
      )}
    </div>
  );
}
