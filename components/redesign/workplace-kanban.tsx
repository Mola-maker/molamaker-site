'use client';

// Workplace — Kanban board
// Three columns: Todo / Doing / Done.
// Drag-and-drop via native HTML drag events (no external lib).
// GET /api/workplace/tasks  POST (create)  PATCH (move)  DELETE (admin+)

import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';

type TaskStatus = 'todo' | 'doing' | 'done';

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  repo_url: string | null;
  created_by_name: string | null;
  position: number;
  created_at: string;
};

type Column = { id: TaskStatus; label: string; color: string };

const COLUMNS: Column[] = [
  { id: 'todo',  label: 'Todo',    color: 'var(--ink-faint)' },
  { id: 'doing', label: 'In Progress', color: 'var(--accent)' },
  { id: 'done',  label: 'Done',    color: 'var(--signal-green)' },
];

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

type CardProps = {
  task: Task;
  canDelete: boolean;
  canEdit: boolean;
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Pick<Task, 'title' | 'description' | 'repo_url'>>) => void;
  onDragStart: (task: Task) => void;
};

function EditableField({
  value, placeholder, multiline, onSave,
}: {
  value: string; placeholder: string; multiline?: boolean;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  // Sync draft when the external value changes and we're not mid-edit.
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);
  useLayoutEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const commit = () => { onSave(draft.trim()); setEditing(false); };
  const cancel = () => { setDraft(value); setEditing(false); };

  if (!editing) {
    return (
      <span
        onClick={() => setEditing(true)}
        title="Click to edit"
        style={{ cursor: 'text', display: 'block' }}
      >
        {value || <span style={{ color: 'var(--ink-faint)', fontStyle: 'italic' }}>{placeholder}</span>}
      </span>
    );
  }

  const props = {
    ref,
    value: draft,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !multiline) { e.preventDefault(); commit(); }
      if (e.key === 'Escape') cancel();
    },
    style: {
      width: '100%', background: 'var(--bg-deep)', border: '1px solid var(--accent)',
      borderRadius: 3, padding: '3px 6px', color: 'var(--ink)',
      fontFamily: 'inherit', fontSize: 'inherit', outline: 'none', resize: 'none' as const,
    },
  };

  return multiline
    ? <textarea {...props} rows={2} />
    : <input {...props} type="text" />;
}

function TaskCard({ task, canDelete, canEdit, onDelete, onUpdate, onDragStart }: CardProps) {
  return (
    <div
      className="kb-card"
      draggable
      onDragStart={() => onDragStart(task)}
    >
      <div className="kb-card__title">
        {canEdit
          ? <EditableField value={task.title} placeholder="Title…" onSave={(v) => v && onUpdate(task.id, { title: v })} />
          : task.title}
      </div>
      <div className="kb-card__desc">
        {canEdit
          ? <EditableField value={task.description ?? ''} placeholder="Add description…" multiline onSave={(v) => onUpdate(task.id, { description: v || null })} />
          : task.description}
      </div>
      <div className="kb-card__meta">
        {canEdit ? (
          <EditableField
            value={task.repo_url ?? ''}
            placeholder="repo URL"
            onSave={(v) => onUpdate(task.id, { repo_url: v || null })}
          />
        ) : task.repo_url && (
          <a href={task.repo_url} target="_blank" rel="noopener noreferrer" className="kb-card__repo" onClick={(e) => e.stopPropagation()}>
            ↗ repo
          </a>
        )}
        <span className="kb-card__time">{relTime(task.created_at)}</span>
        {task.created_by_name && (
          <span className="kb-card__author">{task.created_by_name}</span>
        )}
        {canDelete && (
          <button className="kb-card__del" onClick={() => onDelete(task.id)} aria-label="Delete task">×</button>
        )}
      </div>
    </div>
  );
}

type AddFormProps = { status: TaskStatus; onAdd: (task: Task) => void };

function AddForm({ status, onAdd }: AddFormProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [repo, setRepo] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const submit = async () => {
    if (!title.trim()) return;
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/workplace/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), description: desc.trim() || undefined, status, repoUrl: repo.trim() || undefined }),
      });
      const j = await r.json();
      if (!r.ok) { setErr(j.error ?? 'Failed'); return; }
      onAdd(j.data);
      setTitle(''); setDesc(''); setRepo(''); setOpen(false);
    } catch { setErr('Network error'); }
    finally { setBusy(false); }
  };

  if (!open) {
    return (
      <button className="kb-add-btn" onClick={() => setOpen(true)}>
        + Add card
      </button>
    );
  }

  return (
    <div className="kb-add-form">
      <input
        ref={inputRef}
        className="kb-add-form__input"
        placeholder="Task title…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setOpen(false); }}
      />
      <input
        className="kb-add-form__input"
        placeholder="Description (optional)"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
      />
      <input
        className="kb-add-form__input"
        placeholder="GitHub/repo URL (optional)"
        value={repo}
        onChange={(e) => setRepo(e.target.value)}
      />
      {err && <div className="kb-add-form__err">{err}</div>}
      <div className="kb-add-form__actions">
        <button className="kb-add-form__cancel" onClick={() => setOpen(false)}>Cancel</button>
        <button className="kb-add-form__submit" onClick={submit} disabled={busy || !title.trim()}>
          {busy ? '…' : 'Add'}
        </button>
      </div>
    </div>
  );
}

type Props = { currentRole: 'owner' | 'admin' | 'contributor' | 'viewer' };

export function WorkplaceKanban({ currentRole }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<Task | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);

  const canDelete = currentRole === 'owner' || currentRole === 'admin';
  const canEdit   = currentRole !== 'viewer';

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/workplace/tasks');
      if (!r.ok) return;
      const j = await r.json();
      setTasks(j.data ?? []);
    } catch { /* best-effort */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = (task: Task) => setTasks((prev) => [...prev, task]);

  const handleDelete = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/workplace/tasks?id=${id}`, { method: 'DELETE' });
  };

  const handleUpdate = useCallback(async (id: string, patch: Partial<Pick<Task, 'title' | 'description' | 'repo_url'>>) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, ...patch } : t));
    await fetch('/api/workplace/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    });
  }, []);

  const handleDrop = async (targetStatus: TaskStatus) => {
    if (!dragging || dragging.status === targetStatus) {
      setDragging(null); setDragOver(null); return;
    }
    const updated = { ...dragging, status: targetStatus };
    setTasks((prev) => prev.map((t) => t.id === dragging.id ? updated : t));
    setDragging(null); setDragOver(null);
    await fetch('/api/workplace/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: dragging.id, status: targetStatus }),
    });
  };

  const byStatus = (s: TaskStatus) =>
    tasks.filter((t) => t.status === s).sort((a, b) => a.position - b.position);

  return (
    <div className="kb-board">
      <div className="wp-section-label">
        <span>Board</span>
        <span style={{ fontSize: '9.5px', color: 'var(--ink-soft)' }}>
          {tasks.length} task{tasks.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="kb-columns">
        {COLUMNS.map((col) => (
          <div
            key={col.id}
            className={`kb-col${dragOver === col.id ? ' kb-col--over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(col.id); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={() => handleDrop(col.id)}
          >
            <div className="kb-col__head">
              <span className="kb-col__dot" style={{ background: col.color }} />
              <span className="kb-col__label">{col.label}</span>
              <span className="kb-col__count">{byStatus(col.id).length}</span>
            </div>
            <div className="kb-col__cards">
              {loading
                ? <div className="kb-col__empty">Loading…</div>
                : byStatus(col.id).length === 0
                  ? <div className="kb-col__empty">Empty</div>
                  : byStatus(col.id).map((t) => (
                      <TaskCard
                        key={t.id}
                        task={t}
                        canDelete={canDelete}
                        canEdit={canEdit}
                        onDelete={handleDelete}
                        onUpdate={handleUpdate}
                        onDragStart={setDragging}
                      />
                    ))
              }
            </div>
            {canEdit && <AddForm status={col.id} onAdd={handleAdd} />}
          </div>
        ))}
      </div>
    </div>
  );
}
