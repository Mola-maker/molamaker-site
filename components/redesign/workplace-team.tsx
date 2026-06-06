'use client';

// Workplace — Team panel
// Lists workspace members with role, contact, auth method, last IP and last-seen.
// Owners can change a member's role inline (optimistic, reverts on failure).
// Parent only mounts this for admin/owner; on 403 we render nothing.

import { useState, useEffect, useCallback } from 'react';

type Role = 'owner' | 'admin' | 'contributor' | 'viewer';

type TeamUser = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: string;
  authMethod: string | null;
  lastIp: string | null;
  lastSeenAt: string;
  createdAt: string;
};

const ROLES: Role[] = ['owner', 'admin', 'contributor', 'viewer'];

// ── Tiny relative-time formatter ─────────────────────────────────
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
  return new Date(t).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Compact auth-method label with a leading glyph (icon-text, no external libs).
function authLabel(method: string | null): string {
  switch (method) {
    case 'phone': return '☎ phone';
    case 'wechat': return '✺ wechat';
    case null:
    case undefined: return '—';
    default: return method;
  }
}

function roleClass(role: string): string {
  switch (role) {
    case 'owner': return 'wp-team__role-pill--owner';
    case 'admin': return 'wp-team__role-pill--admin';
    case 'contributor': return 'wp-team__role-pill--contributor';
    default: return 'wp-team__role-pill--viewer';
  }
}

// ── Single member row ────────────────────────────────────────────
function TeamRow({
  user,
  canEdit,
  onRoleChange,
}: {
  user: TeamUser;
  canEdit: boolean;
  onRoleChange: (userId: string, role: Role) => void;
}) {
  const contact = user.phone || user.email || '—';

  return (
    <li className="wp-team__row" role="row">
      <span className="wp-team__name" role="cell">{user.name}</span>

      <span className="wp-team__role" role="cell">
        {canEdit ? (
          <select
            name={`role-${user.id}`}
            className="wp-team__select"
            value={user.role}
            aria-label={`Role for ${user.name}`}
            onChange={(e) => onRoleChange(user.id, e.target.value as Role)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        ) : (
          <span className={`wp-team__role-pill ${roleClass(user.role)}`}>{user.role}</span>
        )}
      </span>

      <span className="wp-team__contact" role="cell">{contact}</span>
      <span className="wp-team__auth" role="cell">{authLabel(user.authMethod)}</span>
      <span className="wp-team__ip" role="cell">{user.lastIp || '—'}</span>
      <span className="wp-team__seen" role="cell">
        <time dateTime={user.lastSeenAt} title={fmtDate(user.lastSeenAt)}>{relTime(user.lastSeenAt)}</time>
      </span>
    </li>
  );
}

// ── Main panel ───────────────────────────────────────────────────
export default function WorkplaceTeam({ currentRole }: { currentRole: Role }) {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const isOwner = currentRole === 'owner';

  useEffect(() => {
    let alive = true;
    fetch('/api/workplace/users', { credentials: 'include' })
      .then((r) => {
        if (r.status === 403 || r.status === 401) {
          if (alive) setForbidden(true);
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((j: { data?: { users: TeamUser[] } } | null) => {
        if (alive && j?.data?.users) setUsers(j.data.users);
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const changeRole = useCallback((userId: string, role: Role) => {
    let previous: string | undefined;
    setUsers((list) =>
      list.map((u) => {
        if (u.id === userId) { previous = u.role; return { ...u, role }; }
        return u;
      })
    );

    fetch('/api/workplace/users/role', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role }),
    })
      .then((r) => {
        if (!r.ok) throw new Error('role update failed');
      })
      .catch(() => {
        // Revert to the captured prior role on failure.
        if (previous === undefined) return;
        setUsers((list) => list.map((u) => (u.id === userId ? { ...u, role: previous as string } : u)));
      });
  }, []);

  // Parent only renders this for admin/owner; on 403 render nothing.
  if (forbidden) return null;

  return (
    <section className="wp-team" aria-label="Team members">
      <div className="wp-section-label">
        <span>Team</span>
        {!loading && <span className="wp-team__count">{users.length}</span>}
      </div>

      {loading && users.length === 0 ? (
        <div className="wp-team__loading" aria-busy="true">
          <div className="wp-skeleton wp-team__skeleton-line" />
          <div className="wp-skeleton wp-team__skeleton-line" />
          <div className="wp-skeleton wp-team__skeleton-line" />
        </div>
      ) : users.length === 0 ? (
        <div className="wp-empty-state">No team members yet.</div>
      ) : (
        <ul className="wp-team__list" role="table">
          <li className="wp-team__row wp-team__row--head" role="row" aria-hidden="true">
            <span className="wp-team__name" role="columnheader">Member</span>
            <span className="wp-team__role" role="columnheader">Role</span>
            <span className="wp-team__contact" role="columnheader">Contact</span>
            <span className="wp-team__auth" role="columnheader">Auth</span>
            <span className="wp-team__ip" role="columnheader">Last IP</span>
            <span className="wp-team__seen" role="columnheader">Last seen</span>
          </li>
          {users.map((u) => (
            <TeamRow key={u.id} user={u} canEdit={isOwner} onRoleChange={changeRole} />
          ))}
        </ul>
      )}
    </section>
  );
}
