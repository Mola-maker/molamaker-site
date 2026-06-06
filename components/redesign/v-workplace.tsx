'use client';

// Variant E — Workplace
// Auth-gated AI workflow orchestration dashboard.
// Default tiles: AstrBot + Math (GeoGebra). Others added via GitHub deploy.
// Tabs: iframe port-switcher. Live SSE message bus.

import { useState, useEffect, useRef, useCallback } from 'react';
import { WorkplaceAuth } from './workplace-auth';
import WorkplaceTeam from './workplace-team';
import WorkplaceActivity from './workplace-activity';
import WorkplaceSettings from './workplace-settings';
import { WorkplaceKanban } from './workplace-kanban';
import { WorkplaceMath } from './workplace-math';
import { assetUrl } from '@/lib/asset-url';
import type { BusMessage } from '@/lib/workplace/bus';

type WorkflowStatus = 'live' | 'offline' | 'starting' | 'error';
type Workflow = {
  id: string;
  name: string;
  port: number;
  url?: string;
  status: WorkflowStatus;
  description?: string;
  githubRepo?: string;
};
type WPUser = { userId: string; name: string; phone?: string; role: string };
type PortTab = { id: string; label: string; type: 'iframe'; url?: string };

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en', { hour12: false });
}

// ── Deploy modal ────────────────────────────────────────────────
function DeployModal({ onClose, onDeploy }: { onClose: () => void; onDeploy: (url: string, name: string) => void }) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!url.trim()) return;
    setBusy(true);
    try {
      const r = await fetch('/api/workplace/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ repoUrl: url.trim(), name: name.trim() || undefined }),
      });
      if (r.ok) { onDeploy(url.trim(), name.trim()); onClose(); }
    } finally { setBusy(false); }
  };

  return (
    <div className="wp-deploy-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="wp-deploy-modal">
        <h3>Deploy from GitHub</h3>
        <input
          type="url"
          placeholder="https://github.com/owner/repo"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          autoFocus
        />
        <input
          type="text"
          placeholder="Display name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <div className="wp-deploy-modal__actions">
          <button className="wp-deploy-modal__cancel" onClick={onClose}>Cancel</button>
          <button className="wp-deploy-modal__submit" onClick={submit} disabled={busy || !url.trim()}>
            {busy ? 'Deploying…' : 'Deploy →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Message bus panel ────────────────────────────────────────────
function MessageBusPanel() {
  const [messages, setMessages] = useState<BusMessage[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource('/api/workplace/messages');
    es.onmessage = (e) => {
      const msg = JSON.parse(e.data) as BusMessage;
      setMessages((m) => [...m.slice(-199), msg]);
      try { window.dispatchEvent(new CustomEvent('wp:bus', { detail: msg })); } catch { /* ignore */ }
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, []);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [messages]);

  return (
    <div className="wp-bus__feed" ref={feedRef}>
      {messages.length === 0
        ? (
          <div className="wp-bus__empty">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={assetUrl('/redesign/miku-dance.gif')} alt="" className="wp-empty-miku" />
            <span>No messages yet — workflows will publish here</span>
          </div>
        )
        : messages.map((m) => (
          <div key={m.id} className={`wp-bus__row${m.level === 'error' ? ' wp-bus__row--error' : ''}`}>
            <span className="wp-bus__workflow">{m.workflow}</span>
            <span className="wp-bus__time">{fmtTime(m.ts)}</span>
            <span className="wp-bus__text">{m.text}</span>
          </div>
        ))
      }
    </div>
  );
}

// ── Workflow tile ────────────────────────────────────────────────
function WorkflowTile({ wf, isActive, isHero, onOpen }: {
  wf: Workflow;
  isActive: boolean;
  isHero?: boolean;
  onOpen: () => void;
}) {
  const dotClass = {
    live: 'wp-tile__dot--live',
    offline: 'wp-tile__dot--offline',
    starting: 'wp-tile__dot--starting',
    error: 'wp-tile__dot--error',
  }[wf.status];

  return (
    <div className={`wp-tile wp-tile--${wf.status}${isHero ? ' wp-tile--hero' : ''}${isActive ? ' is-active' : ''}`} onClick={onOpen}>
      <div className="wp-tile__head">
        <span className="wp-tile__name">{wf.name}</span>
        <span className="wp-tile__status">
          <span className={`wp-tile__dot ${dotClass}`} />
          {wf.status}
        </span>
      </div>
      {wf.description && <div className="wp-tile__desc">{wf.description}</div>}
      <div className="wp-tile__meta">
        <span>port {wf.port}</span>
        {wf.githubRepo && <span>{wf.githubRepo.replace('https://github.com/', '')}</span>}
      </div>
      <div className="wp-tile__actions">
        <button className="wp-tile__btn wp-tile__btn--primary" onClick={(e) => { e.stopPropagation(); onOpen(); }}>
          Open
        </button>
      </div>
    </div>
  );
}

// ── Main VWorkplace ──────────────────────────────────────────────
export function VWorkplace() {
  const [user, setUser] = useState<WPUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [wfLoaded, setWfLoaded] = useState(false);
  const [portTabs, setPortTabs] = useState<PortTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [showDeploy, setShowDeploy] = useState(false);

  // Check auth on mount
  useEffect(() => {
    fetch('/api/workplace/auth/me', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((j: { data?: { user: WPUser } } | null) => {
        if (j?.data?.user) setUser(j.data.user);
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, []);

  // Poll workflow status every 15s when logged in
  useEffect(() => {
    if (!user) return;
    const load = () => {
      fetch('/api/workplace/workflows', { credentials: 'include' })
        .then((r) => r.json())
        .then((j: { data?: { workflows: Workflow[] } }) => {
          if (j.data?.workflows) setWorkflows(j.data.workflows);
        })
        .catch(() => {})
        .finally(() => setWfLoaded(true));
    };
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [user]);

  const handleAuth = useCallback(() => {
    fetch('/api/workplace/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((j: { data?: { user: WPUser } }) => { if (j.data?.user) setUser(j.data.user); })
      .catch(() => {});
  }, []);

  const logout = async () => {
    await fetch('/api/workplace/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
    setPortTabs([]);
    setActiveTab(null);
  };

  const openPort = useCallback((wf: Workflow) => {
    const tabId = `port-${wf.id}`;
    if (!portTabs.find((t) => t.id === tabId)) {
      // Route through the same-origin reverse proxy so the iframe never points
      // at the visitor's localhost or trips https→http mixed-content blocking.
      // A full public https URL on the workflow overrides the proxy.
      const portUrl = (wf.url && /^https:\/\//.test(wf.url)) ? wf.url : `/api/workplace/proxy/${wf.id}`;
      setPortTabs((t) => [...t, { id: tabId, label: wf.name, type: 'iframe', url: portUrl }]);
    }
    setActiveTab(tabId);
  }, [portTabs]);

  const closeTab = (id: string) => {
    setPortTabs((t) => t.filter((tab) => tab.id !== id));
    setActiveTab((cur) => cur === id ? (portTabs.find((t) => t.id !== id)?.id ?? null) : cur);
  };

  const handleDeploy = (_url: string, _name: string) => {
    // Refresh workflows after a brief delay (deploy is async)
    setTimeout(() => {
      fetch('/api/workplace/workflows')
        .then((r) => r.json())
        .then((j: { data?: { workflows: Workflow[] } }) => { if (j.data?.workflows) setWorkflows(j.data.workflows); })
        .catch(() => {});
    }, 2000);
  };

  const currentTab = portTabs.find((t) => t.id === activeTab);

  // Bento hero — the live (or first) workflow gets the large tile.
  const heroId = (workflows.find((w) => w.status === 'live') ?? workflows[0])?.id;

  if (!authChecked) return null; // avoid flash

  if (!user) {
    return (
      <div className="v-workplace">
        <div className="miku-backdrop" aria-hidden="true" />
        <WorkplaceAuth onAuth={handleAuth} />
      </div>
    );
  }

  return (
    <div className="v-workplace">
      <div className="wrap wrap--narrow wp-enter">
        {/* Header + workflows sit over an ambient Miku backdrop (the hero) */}
        <div className="wp-hero has-backdrop">
          <div className="miku-backdrop" aria-hidden="true" />
        <div className="wp-header">
          <h2 className="wp-header__title">work<em>place</em></h2>
          <div className="wp-header__user">
            <span>{user.name}</span>
            <span className="wp-header__role">{user.role}</span>
          </div>
          <button className="wp-header__logout" onClick={logout}>Sign out</button>
        </div>

        {/* Workflow tiles */}
        <div className="wp-section-label">
          <span>Workflows</span>
          <button
            className="wp-tile__btn wp-tile__btn--primary"
            onClick={() => setShowDeploy(true)}
            style={{ marginLeft: 'auto' }}
          >
            + Deploy from GitHub
          </button>
        </div>
        <div className="wp-tiles wp-tiles--bento">
          {!wfLoaded && workflows.length === 0 ? (
            Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="wp-tile wp-tile--skeleton">
                <div className="wp-skeleton wp-skeleton-line wp-skeleton-line--lg" />
                <div className="wp-skeleton wp-skeleton-line wp-skeleton-line--sm" />
                <div className="wp-skeleton wp-skeleton-line" />
              </div>
            ))
          ) : (
            workflows.map((wf) => (
              <WorkflowTile
                key={wf.id}
                wf={wf}
                isActive={portTabs.some((t) => t.id === `port-${wf.id}` && t.id === activeTab)}
                isHero={wf.id === heroId}
                onOpen={() => openPort(wf)}
              />
            ))
          )}
          {/* Math (GeoGebra) sits in the workflows row, aligned with the others. */}
          <WorkplaceMath />
          <div className="wp-tile wp-tile--add" onClick={() => setShowDeploy(true)}>
            <span className="wp-tile__plus">+</span>
            <span className="wp-tile__add-label">Add workflow</span>
          </div>
        </div>
        </div>{/* end .wp-hero */}

        {/* Port switcher */}
        <div className="wp-section-label">Port view</div>
        <div className="wp-ports">
          <div className="wp-port-tabs">
            {portTabs.map((tab) => (
              // A tab can't be a <button> because it contains the close <button>
              // (nested buttons are invalid HTML and break hydration). Use a
              // focusable role="tab" element with keyboard activation instead.
              <div
                key={tab.id}
                role="tab"
                tabIndex={0}
                aria-selected={tab.id === activeTab}
                className={`wp-port-tab${tab.id === activeTab ? ' is-active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTab(tab.id); } }}
              >
                <span className="wp-port-tab__dot" />
                {tab.label}
                <button
                  type="button"
                  className="wp-port-tab__close"
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                  aria-label={`Close ${tab.label}`}
                >×</button>
              </div>
            ))}
          </div>
          <div className={`wp-port-view${!currentTab ? ' wp-port-view--empty' : ''}`}>
            {!currentTab && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={assetUrl('/redesign/miku-dance.gif')} alt="" className="wp-empty-miku" />
                <span>Open a workflow above to preview it here</span>
              </>
            )}
            {currentTab?.type === 'iframe' && (
              <iframe
                key={currentTab.id}
                className="wp-port-iframe"
                src={currentTab.url}
                title={currentTab.label}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            )}
          </div>
        </div>

        {/* Message bus */}
        <div className="wp-bus">
          <div className="wp-section-label">
            <span>Message Bus</span>
            <span style={{ fontSize: '9.5px', color: 'var(--ink-soft)' }}>live · SSE</span>
          </div>
          <MessageBusPanel />
        </div>

        {/* Kanban board — all authenticated roles */}
        <WorkplaceKanban currentRole={user.role as 'owner' | 'admin' | 'contributor' | 'viewer'} />

        {/* Team + Activity + Settings — visible to admins and the owner */}
        {(user.role === 'admin' || user.role === 'owner') && (
          <>
            <WorkplaceTeam currentRole={user.role as 'owner' | 'admin' | 'contributor' | 'viewer'} />
            <WorkplaceActivity />
            <WorkplaceSettings />
          </>
        )}
      </div>

      {/* Deploy modal */}
      {showDeploy && (
        <DeployModal
          onClose={() => setShowDeploy(false)}
          onDeploy={handleDeploy}
        />
      )}
    </div>
  );
}
