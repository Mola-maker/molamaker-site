'use client';

// Variant E — Workplace
// Auth-gated AI workflow orchestration dashboard.
// Default tiles: AstrBot, ClaudeCode. Others added via GitHub deploy.
// Tabs: iframe port-switcher + Claude CLI terminal. Live SSE message bus.

import { useState, useEffect, useRef, useCallback } from 'react';
import { WorkplaceAuth } from './workplace-auth';
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
type PortTab = { id: string; label: string; type: 'iframe' | 'terminal'; url?: string };
type TermLine = { type: 'stdout' | 'stderr' | 'exit' | 'error' | 'info'; text: string };

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

// ── Claude CLI terminal panel ────────────────────────────────────
function ClaudeTerminal() {
  const [lines, setLines] = useState<TermLine[]>([{ type: 'info', text: 'Claude Code CLI ready — enter a prompt and press Run' }]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [lines]);

  const run = useCallback(() => {
    const prompt = input.trim();
    if (!prompt || running) return;
    setInput('');
    setRunning(true);
    setLines((l) => [...l, { type: 'info', text: `$ claude -p "${prompt}"` }]);

    if (esRef.current) { esRef.current.close(); }
    const es = new EventSource(`/api/workplace/claude?prompt=${encodeURIComponent(prompt)}`);
    esRef.current = es;

    es.onmessage = (e) => {
      const msg = JSON.parse(e.data) as { type: string; data: string };
      if (msg.type === 'exit') {
        setRunning(false);
        setLines((l) => [...l, { type: 'exit', text: `[exit ${msg.data}]` }]);
        es.close();
      } else {
        const lineType = msg.type === 'stderr' ? 'stderr' : 'stdout';
        // Split on newlines so each line is its own row
        const chunks = msg.data.split('\n').filter((s) => s);
        setLines((l) => [...l, ...chunks.map((text) => ({ type: lineType as TermLine['type'], text }))]);
      }
    };
    es.onerror = () => {
      setRunning(false);
      setLines((l) => [...l, { type: 'error', text: 'Connection lost' }]);
      es.close();
    };
  }, [input, running]);

  useEffect(() => () => { esRef.current?.close(); }, []);

  return (
    <div className="wp-terminal">
      <div className="wp-terminal__output" ref={outputRef}>
        {lines.map((ln, i) => (
          <div key={i} className={`wp-terminal__line--${ln.type}`}>{ln.text}</div>
        ))}
      </div>
      <div className="wp-terminal__input-row">
        <span className="wp-terminal__prompt">›</span>
        <input
          className="wp-terminal__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
          placeholder="Enter prompt for Claude…"
          disabled={running}
        />
        <button className="wp-terminal__run" onClick={run} disabled={running || !input.trim()}>
          {running ? '…' : 'Run'}
        </button>
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
        ? <div className="wp-bus__empty">No messages yet — workflows will publish here</div>
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
function WorkflowTile({ wf, isActive, onOpen, onOpenTerminal }: {
  wf: Workflow;
  isActive: boolean;
  onOpen: () => void;
  onOpenTerminal: () => void;
}) {
  const dotClass = {
    live: 'wp-tile__dot--live',
    offline: 'wp-tile__dot--offline',
    starting: 'wp-tile__dot--starting',
    error: 'wp-tile__dot--error',
  }[wf.status];

  return (
    <div className={`wp-tile${isActive ? ' is-active' : ''}`} onClick={onOpen}>
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
        {wf.id === 'claude' && (
          <button className="wp-tile__btn" onClick={(e) => { e.stopPropagation(); onOpenTerminal(); }}>
            Terminal
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main VWorkplace ──────────────────────────────────────────────
export function VWorkplace() {
  const [user, setUser] = useState<WPUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [portTabs, setPortTabs] = useState<PortTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [showDeploy, setShowDeploy] = useState(false);

  // Check auth on mount
  useEffect(() => {
    fetch('/api/workplace/auth/me')
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
      fetch('/api/workplace/workflows')
        .then((r) => r.json())
        .then((j: { data?: { workflows: Workflow[] } }) => {
          if (j.data?.workflows) setWorkflows(j.data.workflows);
        })
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [user]);

  const handleAuth = useCallback(() => {
    fetch('/api/workplace/auth/me')
      .then((r) => r.json())
      .then((j: { data?: { user: WPUser } }) => { if (j.data?.user) setUser(j.data.user); })
      .catch(() => {});
  }, []);

  const logout = async () => {
    await fetch('/api/workplace/auth/logout', { method: 'POST' });
    setUser(null);
    setPortTabs([]);
    setActiveTab(null);
  };

  const openPort = useCallback((wf: Workflow) => {
    const tabId = `port-${wf.id}`;
    if (!portTabs.find((t) => t.id === tabId)) {
      const portUrl = wf.url ?? `http://localhost:${wf.port}`;
      setPortTabs((t) => [...t, { id: tabId, label: wf.name, type: 'iframe', url: portUrl }]);
    }
    setActiveTab(tabId);
  }, [portTabs]);

  const openTerminal = useCallback((wf: Workflow) => {
    const tabId = `term-${wf.id}`;
    if (!portTabs.find((t) => t.id === tabId)) {
      setPortTabs((t) => [...t, { id: tabId, label: `${wf.name} CLI`, type: 'terminal' }]);
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

  if (!authChecked) return null; // avoid flash

  if (!user) {
    return (
      <div className="v-workplace">
        <WorkplaceAuth onAuth={handleAuth} />
      </div>
    );
  }

  return (
    <div className="v-workplace">
      {/* Header */}
      <div className="ct-inner">
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
        <div className="wp-tiles">
          {workflows.map((wf) => (
            <WorkflowTile
              key={wf.id}
              wf={wf}
              isActive={portTabs.some((t) => t.id === `port-${wf.id}` && t.id === activeTab)}
              onOpen={() => openPort(wf)}
              onOpenTerminal={() => openTerminal(wf)}
            />
          ))}
          <div className="wp-tile wp-tile--add" onClick={() => setShowDeploy(true)}>
            <span className="wp-tile__plus">+</span>
            <span className="wp-tile__add-label">Add workflow</span>
          </div>
        </div>

        {/* Port switcher */}
        <div className="wp-section-label">Port view</div>
        <div className="wp-ports">
          <div className="wp-port-tabs">
            {portTabs.map((tab) => (
              <button
                key={tab.id}
                className={`wp-port-tab${tab.id === activeTab ? ' is-active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="wp-port-tab__dot" />
                {tab.label}
                <button
                  className="wp-port-tab__close"
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                  aria-label={`Close ${tab.label}`}
                >×</button>
              </button>
            ))}
            {portTabs.length === 0 && (
              <span style={{ padding: '10px 16px', fontSize: '10.5px', color: 'var(--ink-soft)' }}>
                Open a workflow to view its UI here
              </span>
            )}
          </div>
          <div className={`wp-port-view${!currentTab ? ' wp-port-view--empty' : ''}`}>
            {!currentTab && <span>No port selected</span>}
            {currentTab?.type === 'iframe' && (
              <iframe
                key={currentTab.id}
                className="wp-port-iframe"
                src={currentTab.url}
                title={currentTab.label}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            )}
            {currentTab?.type === 'terminal' && <ClaudeTerminal />}
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
