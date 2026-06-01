'use client';

import { useEffect, useState } from 'react';

type DailyBucket = { date: string; count: number };
type TopPage    = { path: string; count: number };
type TopPost    = { slug: string; title: string; view_count: number };
type Analytics  = {
  totalViews: number;
  daily: DailyBucket[];
  topPages: TopPage[];
  reactionTotals: Record<string, number>;
  topPosts: TopPost[];
  guestCount: number;
};

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono, monospace)' };

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div style={{
      background: 'var(--bg-elev)', border: '1px solid var(--rule)',
      borderRadius: 6, padding: '18px 22px',
    }}>
      <div style={{ ...mono, fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 500, color: accent ? 'var(--accent)' : 'var(--ink)', letterSpacing: '-0.02em' }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  );
}

function MiniBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 48px', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: '1px dotted var(--rule)' }}>
      <div style={{ ...mono, fontSize: 11, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </div>
      <div style={{ height: 4, background: 'var(--rule)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 2 }} />
      </div>
      <div style={{ ...mono, fontSize: 11, color: 'var(--ink-soft)', textAlign: 'right' }}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function SparkLine({ data }: { data: DailyBucket[] }) {
  if (data.length < 2) return null;
  const max = Math.max(...data.map((d) => d.count), 1);
  const W = 100, H = 40;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - (d.count / max) * H;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div>
      <div style={{ ...mono, fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 8 }}>
        Views · last 30 days
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 60, overflow: 'visible' }}
        preserveAspectRatio="none"
      >
        <polyline
          points={pts}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Area fill */}
        <polygon
          points={`0,${H} ${pts} ${W},${H}`}
          fill="var(--accent)"
          opacity="0.08"
        />
        {/* Latest dot */}
        {data.length > 0 && (() => {
          const last = data[data.length - 1];
          const x = W;
          const y = H - (last.count / max) * H;
          return <circle cx={x} cy={y} r="2.5" fill="var(--accent)" />;
        })()}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', ...mono, fontSize: 9, color: 'var(--ink-faint)', marginTop: 4 }}>
        <span>{data[0]?.date?.slice(5)}</span>
        <span>{data[data.length - 1]?.date?.slice(5)}</span>
      </div>
    </div>
  );
}

export function AnalyticsDashboard() {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/analytics')
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json() as Promise<{ data?: Analytics }>;
      })
      .then((j) => setData(j.data ?? null))
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return (
    <div style={{ padding: '40px 0' }}>
      <div className="label">Analytics</div>
      <p style={{ color: '#b43e3e', ...mono, fontSize: 13 }}>Failed to load: {error}</p>
    </div>
  );

  if (!data) return (
    <div style={{ padding: '40px 0' }}>
      <div className="label">Analytics</div>
      <p style={{ ...mono, fontSize: 12, color: 'var(--ink-soft)' }}>Loading…</p>
    </div>
  );

  const totalReactions = Object.values(data.reactionTotals).reduce((a, b) => a + b, 0);
  const maxPage = Math.max(...data.topPages.map((p) => p.count), 1);
  const maxPost = Math.max(...data.topPosts.map((p) => p.view_count ?? 0), 1);

  return (
    <div style={{ padding: '40px 0' }}>
      <div className="label">Admin</div>
      <h2 style={{ marginBottom: 8 }}>Analytics</h2>
      <p style={{ ...mono, fontSize: 11, color: 'var(--ink-soft)', marginBottom: 40 }}>
        Analytics · Site traffic · last 30 days
      </p>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 40 }}>
        <Stat label="Page views (30d)" value={data.totalViews} accent />
        <Stat label="Reactions" value={totalReactions} />
        <Stat label="Guest entries" value={data.guestCount} />
        <Stat label="❤ Hearts" value={data.reactionTotals.heart ?? 0} />
        <Stat label="⚙ Brains" value={data.reactionTotals.brain ?? 0} />
        <Stat label="✦ Fires" value={data.reactionTotals.fire ?? 0} />
      </div>

      {/* Sparkline chart */}
      <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--rule)', borderRadius: 6, padding: '20px 24px', marginBottom: 28 }}>
        <SparkLine data={data.daily} />
      </div>

      {/* Top pages + Top posts side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
        <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--rule)', borderRadius: 6, padding: '18px 20px' }}>
          <div style={{ ...mono, fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 14 }}>
            Top pages
          </div>
          {data.topPages.map((p) => (
            <MiniBar key={p.path} label={p.path} value={p.count} max={maxPage} />
          ))}
        </div>
        <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--rule)', borderRadius: 6, padding: '18px 20px' }}>
          <div style={{ ...mono, fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 14 }}>
            Top posts (all time views)
          </div>
          {data.topPosts.map((p) => (
            <MiniBar key={p.slug} label={p.title} value={p.view_count ?? 0} max={maxPost} />
          ))}
        </div>
      </div>

      {/* Admin links */}
      <div style={{ ...mono, fontSize: 11, color: 'var(--ink-soft)' }}>
        <a href="../admin" style={{ color: 'var(--accent)' }}>← Back to admin</a>
      </div>
    </div>
  );
}
