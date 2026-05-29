'use client';

import { useState, useEffect, useRef } from 'react';

type Entry = { term: string; definition: string };

export function GlossaryAdmin() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [term, setTerm] = useState('');
  const [def, setDef] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const termRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/glossary');
      const j = await r.json();
      const data: Record<string, string> = j.data ?? {};
      setEntries(Object.entries(data).map(([t, d]) => ({ term: t, definition: d })).sort((a, b) => a.term.localeCompare(b.term)));
    } catch { /* best-effort */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const startEdit = (e: Entry) => {
    setEditing(e.term);
    setTerm(e.term);
    setDef(e.definition);
    setErr('');
    setTimeout(() => termRef.current?.focus(), 0);
  };

  const cancel = () => { setEditing(null); setTerm(''); setDef(''); setErr(''); };

  const save = async () => {
    if (!term.trim() || !def.trim()) { setErr('Both fields required'); return; }
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/glossary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term: term.trim(), definition: def.trim() }),
      });
      if (!r.ok) { const j = await r.json(); setErr(j.error ?? 'Failed'); return; }
      await load();
      cancel();
    } catch { setErr('Network error'); }
    finally { setBusy(false); }
  };

  const remove = async (t: string) => {
    if (!confirm(`Delete "${t}"?`)) return;
    try {
      await fetch(`/api/glossary?term=${encodeURIComponent(t)}`, { method: 'DELETE' });
      setEntries((prev) => prev.filter((e) => e.term !== t));
    } catch { /* best-effort */ }
  };

  return (
    <div style={{ marginTop: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="label" style={{ marginBottom: 0 }}>Glossary</div>
        {editing !== 'new' && (
          <button className="admin-btn" onClick={() => { setEditing('new'); setTerm(''); setDef(''); setErr(''); setTimeout(() => termRef.current?.focus(), 0); }}>
            + New term
          </button>
        )}
      </div>

      {(editing === 'new' || (editing && editing !== 'new')) && (
        <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--rule)', borderRadius: 6, padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-soft)', marginBottom: 4 }}>TERM</label>
              <input
                ref={termRef}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                disabled={editing !== 'new'}
                style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--rule)', borderRadius: 3, padding: '6px 10px', color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: 13, opacity: editing !== 'new' ? 0.6 : 1 }}
                placeholder="CUDA"
                onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-soft)', marginBottom: 4 }}>DEFINITION</label>
              <input
                value={def}
                onChange={(e) => setDef(e.target.value)}
                style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--rule)', borderRadius: 3, padding: '6px 10px', color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: 13 }}
                placeholder="A parallel computing platform…"
                onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
              />
            </div>
          </div>
          {err && <div style={{ color: 'var(--signal-red, #c0392b)', fontFamily: 'var(--font-mono)', fontSize: 11, marginBottom: 8 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="admin-btn" onClick={cancel} style={{ opacity: 0.6 }}>Cancel</button>
            <button className="send" onClick={save} disabled={busy} style={{ padding: '6px 18px', fontSize: 12 }}>
              {busy ? '…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-soft)' }}>Loading…</div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: '22%' }}>Term</th>
              <th>Definition</th>
              <th style={{ textAlign: 'right', width: 120 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.term}>
                <td className="admin-mono" style={{ verticalAlign: 'top', paddingTop: 10 }}>{e.term}</td>
                <td style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>{e.definition}</td>
                <td style={{ verticalAlign: 'top', paddingTop: 8 }}>
                  <div className="admin-actions">
                    <button className="admin-btn" onClick={() => startEdit(e)}>Edit</button>
                    <button className="admin-btn" onClick={() => remove(e.term)} style={{ color: 'var(--signal-red, #c0392b)' }}>×</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
