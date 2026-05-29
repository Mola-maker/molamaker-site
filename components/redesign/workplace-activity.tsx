'use client';

// Workplace — Activity feed (audit log)
// Renders the workspace audit trail as a vertical timeline, newest first.
// Parent only mounts this for admin/owner; on 401/403 we render nothing.

import { useState, useEffect } from 'react';

type Action =
  | 'login'
  | 'logout'
  | 'deploy'
  | 'workflow_add'
  | 'claude_run'
  | 'role_change';

type AuditEvent = {
  id: string;
  action: string;
  userName: string | null;
  ip: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
};

// ── Tiny relative-time formatter (copied from workplace-team.tsx) ─
function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Date.now() - then;
  if (diff < 0) return 'just now';
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  // Fall back to an absolute date for anything older than ~a month.
  return new Date(then).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtDate(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  return new Date(t).toLocaleString('en', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// Safely coerce an unknown detail field to a trimmed string (empty when absent).
function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.trim();
  return String(v);
}

// ── Pure helper: human-readable phrase from action + detail ──────
function describe(action: string, detail: Record<string, unknown>): string {
  const d = detail || {};
  switch (action) {
    case 'login':
      return 'signed in';
    case 'logout':
      return 'signed out';
    case 'deploy': {
      const name = str(d.name) || str(d.id);
      return `deployed ${name || 'a workflow'}`;
    }
    case 'workflow_add': {
      const name = str(d.name) || str(d.id);
      return `added workflow ${name}`.trimEnd();
    }
    case 'role_change': {
      const who = str(d.changedUser);
      const role = str(d.newRole);
      if (who && role) return `set ${who} → ${role}`;
      if (role) return `changed a role → ${role}`;
      return 'changed a role';
    }
    case 'claude_run':
      return 'ran Claude CLI';
    default:
      return action.replace(/_/g, ' ');
  }
}

// Short uppercase glyph for the action badge.
function actionGlyph(action: string): string {
  switch (action) {
    case 'login': return 'IN';
    case 'logout': return 'OUT';
    case 'deploy': return 'DEP';
    case 'workflow_add': return 'ADD';
    case 'claude_run': return 'CLI';
    case 'role_change': return 'ROL';
    default: return '•';
  }
}

// Map each action to its tint modifier class.
function badgeClass(action: string): string {
  const map: Record<Action, string> = {
    login: 'wp-activity__badge--login',
    logout: 'wp-activity__badge--logout',
    deploy: 'wp-activity__badge--deploy',
    role_change: 'wp-activity__badge--role',
    workflow_add: 'wp-activity__badge--workflow',
    claude_run: 'wp-activity__badge--claude',
  };
  return map[action as Action] || 'wp-activity__badge--default';
}

// ── Single event row ─────────────────────────────────────────────
function ActivityRow({ ev }: { ev: AuditEvent }) {
  const actor = ev.userName || 'system';
  return (
    <li className="wp-activity__row" role="listitem">
      <span className={`wp-activity__badge ${badgeClass(ev.action)}`} aria-hidden="true">
        {actionGlyph(ev.action)}
      </span>
      <span className="wp-activity__main">
        <span className="wp-activity__line">
          <span className="wp-activity__actor">{actor}</span>
          <span className="wp-activity__desc">{describe(ev.action, ev.detail)}</span>
        </span>
        {ev.ip && <span className="wp-activity__ip">{ev.ip}</span>}
      </span>
      <span className="wp-activity__time">
        <time dateTime={ev.createdAt} title={fmtDate(ev.createdAt)}>{relTime(ev.createdAt)}</time>
      </span>
    </li>
  );
}

// ── Main panel ───────────────────────────────────────────────────
export default function WorkplaceActivity() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/workplace/audit', { credentials: 'include' })
      .then((r) => {
        if (r.status === 403 || r.status === 401) {
          if (alive) setForbidden(true);
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((j: { data?: { events: AuditEvent[] } } | null) => {
        if (alive && j?.data?.events) setEvents(j.data.events);
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // Parent only renders this for admin/owner; on 403 render nothing.
  if (forbidden) return null;

  return (
    <section className="wp-activity" aria-label="Activity log">
      <div className="wp-section-label">
        <span>Activity</span>
        {!loading && <span className="wp-activity__count">{events.length}</span>}
      </div>

      {loading && events.length === 0 ? (
        <div className="wp-activity__loading" aria-busy="true">
          <div className="wp-skeleton wp-activity__skeleton-line" />
          <div className="wp-skeleton wp-activity__skeleton-line" />
          <div className="wp-skeleton wp-activity__skeleton-line" />
        </div>
      ) : events.length === 0 ? (
        <div className="wp-empty-state">No activity yet.</div>
      ) : (
        <ul className="wp-activity__list" role="list">
          {events.map((ev) => (
            <ActivityRow key={ev.id} ev={ev} />
          ))}
        </ul>
      )}
    </section>
  );
}
