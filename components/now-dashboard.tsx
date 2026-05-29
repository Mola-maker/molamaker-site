'use client';

import { useEffect, useState } from 'react';

type NowPlayingData = {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  duration: number;
  recent: string[];
};

type CommitItem = {
  id: string;
  repo: string;
  message: string;
  time: string;
  hash: string;
};

type PostItem = {
  slug: string;
  title: string;
  date: string;
  readTime: number;
  tag: string;
  excerpt: string;
};

function Pulse() {
  return (
    <span style={{
      display: 'inline-block',
      width: 7, height: 7,
      borderRadius: '50%',
      background: 'var(--signal-green, #4ade80)',
      marginRight: 6,
      animation: 'now-pulse 2s ease-in-out infinite',
    }} />
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--font-mono, monospace)',
      fontSize: 10,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      color: 'var(--ink-soft, #8B816E)',
      marginBottom: 16,
      paddingBottom: 8,
      borderBottom: '1px solid var(--rule, #DDD3BD)',
    }}>
      {children}
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--bg-elev, #FAF7F1)',
      border: '1px solid var(--rule, #DDD3BD)',
      borderRadius: 4,
      padding: '20px 22px',
      ...style,
    }}>
      {children}
    </div>
  );
}

function MusicCard({ data }: { data: NowPlayingData | null }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!data) return;
    const interval = setInterval(() => {
      setProgress((p) => (p >= 100 ? 0 : p + 0.5));
    }, 500);
    return () => clearInterval(interval);
  }, [data]);

  if (!data) {
    return (
      <Card>
        <SectionLabel>Now playing</SectionLabel>
        <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12, color: 'var(--ink-soft)' }}>
          Nothing playing — check back later.
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <SectionLabel><Pulse />Now playing</SectionLabel>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {data.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.cover}
            alt={data.album}
            style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-serif, serif)',
            fontSize: 17,
            fontWeight: 500,
            color: 'var(--ink)',
            marginBottom: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {data.title}
          </div>
          <div style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 12,
            color: 'var(--ink-soft)',
            marginBottom: 12,
          }}>
            {data.artist} — {data.album}
          </div>
          {/* Progress bar */}
          <div style={{
            height: 2,
            background: 'var(--rule)',
            borderRadius: 1,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              background: 'var(--accent, #C96442)',
              transition: 'width 0.5s linear',
            }} />
          </div>
        </div>
      </div>
      {data.recent.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 9.5,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--ink-faint)',
            marginBottom: 6,
          }}>
            Up next
          </div>
          {data.recent.slice(0, 3).map((track, i) => (
            <div key={i} style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 11,
              color: 'var(--ink-soft)',
              padding: '3px 0',
              borderBottom: '1px dotted var(--rule)',
            }}>
              {String(i + 2).padStart(2, '0')} · {track}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function CommitsCard({ commits }: { commits: CommitItem[] }) {
  return (
    <Card>
      <SectionLabel><Pulse />Recent commits</SectionLabel>
      {commits.length === 0 ? (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-soft)' }}>
          Loading commits…
        </div>
      ) : (
        commits.slice(0, 5).map((c) => (
          <div key={c.id} style={{
            display: 'grid',
            gridTemplateColumns: '64px 1fr auto',
            gap: 10,
            padding: '10px 0',
            borderBottom: '1px dotted var(--rule)',
            alignItems: 'start',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)' }}>
              {c.hash}
            </div>
            <div>
              <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.4, marginBottom: 2 }}>
                {c.message}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-soft)' }}>
                {c.repo}
              </div>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>
              {c.time}
            </div>
          </div>
        ))
      )}
    </Card>
  );
}

function PostsCard({ posts }: { posts: PostItem[] }) {
  return (
    <Card>
      <SectionLabel>Recent writing</SectionLabel>
      {posts.length === 0 ? (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-soft)' }}>
          Loading posts…
        </div>
      ) : (
        posts.slice(0, 3).map((p) => (
          <a
            key={p.slug}
            href={`/en/blog/${p.slug}`}
            style={{
              display: 'block',
              padding: '12px 0',
              borderBottom: '1px dotted var(--rule)',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--accent)',
              marginBottom: 4,
            }}>
              {p.tag} · {p.readTime} min
            </div>
            <div style={{ fontSize: 14, color: 'var(--ink)', marginBottom: 4 }}>
              {p.title}
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--ink-faint)',
            }}>
              {p.date}
            </div>
          </a>
        ))
      )}
    </Card>
  );
}

const STATUS_ITEMS = [
  { key: 'Location', value: 'Hangzhou, CN', mono: true },
  { key: 'Timezone', value: 'CST (UTC+8)', mono: true },
  { key: 'Focus', value: 'CUDA kernels + agent systems', mono: false },
  { key: 'Reading', value: 'Programming Massively Parallel Processors', mono: false },
  { key: 'Editor', value: 'VS Code + Windows Terminal', mono: true },
  { key: 'Languages', value: 'TypeScript, Python, CUDA C++', mono: false },
];

function StatusCard() {
  const now = new Date();
  const cstHour = (now.getUTCHours() + 8) % 24;
  const timeStr = `${String(cstHour).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')} CST`;

  return (
    <Card>
      <SectionLabel>Status</SectionLabel>
      {[...STATUS_ITEMS, { key: 'Local time', value: timeStr, mono: true }].map(({ key, value, mono }) => (
        <div key={key} style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '7px 0',
          borderBottom: '1px dotted var(--rule)',
          gap: 16,
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10.5,
            color: 'var(--ink-soft)',
            letterSpacing: '0.06em',
            flexShrink: 0,
          }}>
            {key}
          </span>
          <span style={{
            fontFamily: mono ? 'var(--font-mono)' : 'inherit',
            fontSize: mono ? 11 : 13,
            color: 'var(--ink)',
            textAlign: 'right',
          }}>
            {value}
          </span>
        </div>
      ))}
    </Card>
  );
}

export function NowDashboard() {
  const [nowPlaying, setNowPlaying] = useState<NowPlayingData | null | undefined>(undefined);
  const [commits, setCommits] = useState<CommitItem[]>([]);
  const [posts, setPosts] = useState<PostItem[]>([]);

  const updated = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  useEffect(() => {
    fetch('/api/music/nowplaying')
      .then((r) => r.json())
      .then((j) => setNowPlaying(j.data ?? null))
      .catch(() => setNowPlaying(null));

    fetch('/api/github/commits')
      .then((r) => r.json())
      .then((j) => {
        const data = j.data ?? [];
        setCommits(data.map((c: Record<string, unknown>) => ({
          id: String(c.id ?? c.hash ?? Math.random()),
          repo: String(c.repo ?? ''),
          message: String(c.message ?? ''),
          time: String(c.time ?? ''),
          hash: String(c.hash ?? ''),
        })));
      })
      .catch(() => {});

    fetch('/api/posts')
      .then((r) => r.json())
      .then((j) => {
        const data = j.data ?? [];
        setPosts(data.map((p: Record<string, unknown>) => ({
          slug: String(p.slug ?? ''),
          title: String(p.title ?? ''),
          date: String(p.date ?? ''),
          readTime: Number(p.readTime ?? p.read_time ?? 5),
          tag: String(p.tag ?? ''),
          excerpt: String(p.excerpt ?? ''),
        })));
      })
      .catch(() => {});
  }, []);

  return (
    <section>
      <style>{`
        @keyframes now-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
      `}</style>

      <div className="label">Now</div>
      <h2 style={{ marginBottom: 6 }}>What I&apos;m up to, live.</h2>
      <p style={{
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: 12,
        color: 'var(--ink-soft)',
        marginBottom: 40,
      }}>
        <Pulse />Live · {updated}
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 20,
        maxWidth: 960,
      }}>
        <MusicCard data={nowPlaying ?? null} />
        <StatusCard />
        <CommitsCard commits={commits} />
        <PostsCard posts={posts} />
      </div>

      <div style={{
        marginTop: 48,
        paddingTop: 24,
        borderTop: '1px solid var(--rule)',
        maxWidth: 960,
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10.5,
          color: 'var(--ink-soft)',
          marginBottom: 16,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>
          Context
        </div>
        <div style={{
          fontSize: 15,
          lineHeight: 1.8,
          color: 'var(--ink-2)',
          maxWidth: '60ch',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          <p>
            Deep in the CUDA programming model — writing kernels, understanding warp-level execution,
            and slowly building intuition for how data movement dominates everything on the GPU.
          </p>
          <p>
            Building a multi-agent CMS that coordinates LLM-backed specialists through a shared
            context layer. The goal: agents plan, edit, and publish collaboratively, human in the loop
            only when it matters.
          </p>
          <p>
            Working through <em>Programming Massively Parallel Processors</em> (4th ed.) cover to
            cover. The exercises are brutal. Highly recommended.
          </p>
        </div>
      </div>
    </section>
  );
}
