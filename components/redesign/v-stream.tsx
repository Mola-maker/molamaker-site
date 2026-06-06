'use client';

// Variant D: Stream — filterable life-signal feed with real data polling,
// spinning vinyl, reaction buttons, and enhanced GUESTS/VISITORS/LEARNING cards.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { I18nBlock, Locale, Signal } from './data';
import { molaData } from './data';
import { AButton, HoverText, useReveal } from './atoms';
import { VisitorConstellation } from '@/components/visitor-constellation';
import { assetUrl } from '@/lib/asset-url';

type Props = { t: I18nBlock; locale: Locale };

export function VStream({ t, locale }: Props) {
  const d = molaData;
  const [filter, setFilter] = useState<string>('all');
  const [visitors, setVisitors] = useState(d.visitor);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [liveSignals, setLiveSignals] = useState<Signal[] | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Track the currently playing song from the music player
  const [nowPlaying, setNowPlaying] = useState<{ id: number; title: string; artist: string; playing: boolean } | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const { id, title, artist, playing } = (e as CustomEvent<{ id: number; title: string; artist: string; playing: boolean }>).detail;
      setNowPlaying({ id, title, artist, playing });
    };
    window.addEventListener('mola:now-playing', handler);
    return () => window.removeEventListener('mola:now-playing', handler);
  }, []);

  // Ambient visitor tick
  useEffect(() => {
    const id = setInterval(() => setVisitors((v) => v + (Math.random() < 0.6 ? 0 : 1)), 3500);
    return () => clearInterval(id);
  }, []);

  // Initial load + 30-second polling
  useEffect(() => {
    let mounted = true;

    const load = () => {
      fetch('/api/stream')
        .then((r) => r.json())
        .then((json: { data?: { signals: Signal[] } }) => {
          if (!mounted) return;
          const sigs = json.data?.signals;
          if (Array.isArray(sigs) && sigs.length > 0) {
            setLiveSignals(sigs);
            setIsLive(true);
          }
        })
        .catch(() => {})
        .finally(() => { if (mounted) setIsLoading(false); });
    };

    load();
    const id = setInterval(load, 30_000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  useReveal(`${locale}:${liveSignals?.length ?? 0}:${filter}`);

  const filters = [
    { id: 'all', label: locale === 'zh' ? '全部' : 'All', color: 'var(--ink)' },
    { id: 'commit', label: locale === 'zh' ? '提交' : 'Commits', color: 'oklch(72% 0.16 145)' },
    { id: 'song', label: locale === 'zh' ? '歌曲' : 'Songs', color: 'var(--accent)' },
    { id: 'post', label: locale === 'zh' ? '文章' : 'Posts', color: 'var(--accent-soft)' },
    { id: 'guestbook', label: locale === 'zh' ? '留言' : 'Guests', color: 'oklch(68% 0.12 75)' },
    { id: 'learning', label: locale === 'zh' ? '学习' : 'Learning', color: 'oklch(60% 0.10 240)' },
    { id: 'visitor', label: locale === 'zh' ? '访客' : 'Visitors', color: 'var(--ink-faint)' },
    { id: 'deploy', label: locale === 'zh' ? '部署' : 'Deploys', color: 'oklch(65% 0.14 200)' },
    { id: 'note', label: locale === 'zh' ? '笔记' : 'Notes', color: 'oklch(70% 0.10 290)' },
  ];

  const signals = liveSignals ?? d.signals;

  // Inject a synthetic song card when the music player plays a song not in the stream data
  const items: Signal[] = useMemo(() => {
    let sigs: Signal[] = filter === 'all' ? signals : signals.filter((s) => s.kind === filter);

    if (nowPlaying && nowPlaying.playing) {
      const exists = sigs.some((s) => {
        if (s.kind !== 'song') return false;
        const sid = String((s as Record<string, unknown>).id ?? '');
        const neId = sid.startsWith('song-') ? sid.slice(5) : sid;
        return Number(neId) === nowPlaying.id;
      });
      if (!exists) {
        const synthetic: Signal = {
          kind: 'song',
          time: 'now',
          title: nowPlaying.title,
          artist: nowPlaying.artist,
          album: '♪',
          cover: '',
          progress: 0,
          length: '0:00',
          position: '0:00',
          bpm: 0,
          key: '—',
          mood: '—',
          recent: [],
        };
        (synthetic as Record<string, unknown>).id = `song-${nowPlaying.id}`;
        sigs = [synthetic, ...sigs];
      }
    }

    return sigs;
  }, [signals, filter, nowPlaying]);

  const signalKey = (s: Signal, i: number): string => {
    const id = (s as { id?: string | number }).id;
    if (id != null) return String(id);
    const title = (s as { title?: string }).title ?? (s as { message?: string }).message ?? (s as { value?: unknown }).value ?? '';
    return `${s.kind}:${s.time}:${String(title)}:${i}`;
  };

  const toggle = (key: string) => {
    setExpanded((cur) => {
      const n = new Set(cur);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  };

  const compose = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const name = (form.elements.namedItem('name') as HTMLInputElement)?.value.trim();
    const message = (form.elements.namedItem('message') as HTMLInputElement)?.value.trim();
    if (!name || !message) return;
    form.reset();
    fetch('/api/guestbook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, message }),
    }).catch(() => {});
  };

  return (
    <div className="v-stream">
      <div className="wrap" id="top">
        <section className="stream-hero has-backdrop">
          <div className="miku-backdrop"></div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 22 }}>
              {t.eyebrow} · {locale === 'zh' ? '生命信号' : 'life-signal feed'}
            </div>
            <h1>
              {locale === 'zh' ? (
                <>
                  <HoverText text="这是我桌边的" mode="heat" />
                  <em>
                    {' '}
                    <HoverText text="心电图" mode="heat" />{' '}
                  </em>
                  <HoverText text="。" mode="heat" />
                </>
              ) : (
                <>
                  <HoverText text="The " mode="heat" />
                  <em>
                    <HoverText text="heartbeat" mode="heat" />
                  </em>
                  <HoverText text=" of a small desk." mode="heat" />
                </>
              )}
            </h1>
            <p>{t.lead}</p>
          </div>
          <aside className="stream-summary reveal">
            <div className="row">
              <span className="k">live</span>
              <span className="v">
                <span className="pulse"></span>&nbsp;
                {isLive ? (
                  <span style={{ color: 'oklch(72% 0.16 145)', fontWeight: 600 }}>Live</span>
                ) : (
                  'streaming'
                )}
              </span>
            </div>
            <div className="row">
              <span className="k">visitors</span>
              <span className="v accent" style={{ fontVariantNumeric: 'tabular-nums' }}>
                #{visitors.toLocaleString()}
              </span>
            </div>
            <div className="row"><span className="k">commits / wk</span><span className="v">28</span></div>
            <div className="row"><span className="k">posts / mo</span><span className="v">3</span></div>
            <div className="row"><span className="k">listens / day</span><span className="v">~62</span></div>
            <div className="row"><span className="k">guests / mo</span><span className="v">18</span></div>
            <div className="row"><span className="k">depth</span><span className="v">tap a row →</span></div>
          </aside>
        </section>

        <section className="reveal" style={{ marginBottom: 32 }}>
          <VisitorConstellation />
        </section>

        <div className="stream-filters reveal" role="tablist">
          {filters.map((f) => (
            <button
              key={f.id}
              className="chip"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              data-magnet
            >
              <span
                className="swatch"
                style={{ background: f.color, width: 6, height: 6, borderRadius: '50%', display: 'inline-block' }}
              ></span>
              {f.label}
            </button>
          ))}
          <span className="filter-count">
            {items.length} {locale === 'zh' ? '条' : 'signals'}
          </span>
        </div>

        <div className="rail" id="sec-2">
          {isLoading && liveSignals === null ? (
            <StreamSkeleton />
          ) : (
            items.map((s, i) => {
              const k = signalKey(s, i);
              return (
                <SignalRow key={k} idx={i} s={s} locale={locale} open={expanded.has(k)} onToggle={() => toggle(k)} />
              );
            })
          )}
        </div>

        <div className="stream-end reveal" id="sec-5">
          <h3>{locale === 'zh' ? '在这片信号里留下一道波' : 'Leave a wave in this signal'}</h3>
          <p>
            {locale === 'zh'
              ? '你的留言会出现在这条河的下一格。'
              : 'Your message becomes the next cell in this little river.'}
          </p>
          <form onSubmit={compose}>
            <input name="name" placeholder={locale === 'zh' ? '名字' : 'your name'} />
            <input name="message" placeholder={locale === 'zh' ? '说点什么…' : 'say something…'} />
            <AButton kind="arrow" solid type="submit">
              {locale === 'zh' ? '寄出' : 'send'}
            </AButton>
          </form>
        </div>
      </div>
    </div>
  );
}

function StreamSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="signal reveal" style={{ opacity: 0.5 }}>
          <div className="signal__head" style={{ pointerEvents: 'none' }}>
            <div
              className="signal__time"
              style={{
                background: 'var(--ink-faint)',
                borderRadius: 4,
                width: 64,
                height: 10,
                animation: 'pulse 1.4s ease-in-out infinite',
                animationDelay: `${i * 120}ms`,
              }}
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div
                style={{
                  background: 'var(--ink-faint)',
                  borderRadius: 4,
                  width: `${55 + (i % 3) * 15}%`,
                  height: 12,
                  animation: 'pulse 1.4s ease-in-out infinite',
                  animationDelay: `${i * 120 + 60}ms`,
                }}
              />
              <div
                style={{
                  background: 'var(--ink-faint)',
                  borderRadius: 4,
                  width: '35%',
                  height: 9,
                  animation: 'pulse 1.4s ease-in-out infinite',
                  animationDelay: `${i * 120 + 120}ms`,
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

function SignalRow({ s, locale, open, onToggle, idx }: { s: Signal; locale: Locale; open: boolean; onToggle: () => void; idx: number }) {
  return (
    <div
      className={`signal signal--${s.kind} ${open ? 'is-open' : ''} signal--mount`}
      style={{ animationDelay: `${idx * 36}ms` }}
      data-hover
    >
      {/* Miku decoration on song rows */}
      {s.kind === 'song' && (
        <span className="signal-miku" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={assetUrl('/redesign/miku-dance.gif')} alt="" />
        </span>
      )}
      <button className="signal__head" onClick={onToggle} aria-expanded={open}>
        <div className="signal__time">
          <span className="kind">{s.kind}</span>
          {s.time}
        </div>
        <div className="signal__main">
          {s.kind === 'commit' && <CommitHead s={s} />}
          {s.kind === 'song' && <SongHead s={s} />}
          {s.kind === 'post' && <PostHead s={s} />}
          {s.kind === 'guestbook' && <GuestHead s={s} />}
          {s.kind === 'visitor' && <VisitorHead s={s} />}
          {s.kind === 'learning' && <LearningHead s={s} />}
          {s.kind === 'deploy' && <DeployHead s={s} />}
          {s.kind === 'note' && <NoteHead s={s} />}
        </div>
        <span className="signal__chev" aria-hidden="true">
          {open ? '−' : '+'}
        </span>
      </button>
      <div className="signal__body-wrap" style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
        <div className="signal__body">
          {s.kind === 'commit' && <CommitBody s={s} />}
          {s.kind === 'song' && <SongBody s={s} />}
          {s.kind === 'post' && <PostBody s={s} locale={locale} />}
          {s.kind === 'guestbook' && <GuestBody s={s} />}
          {s.kind === 'visitor' && <VisitorBody s={s} />}
          {s.kind === 'learning' && <LearningBody s={s} />}
          {s.kind === 'deploy' && <DeployBody s={s} />}
          {s.kind === 'note' && <NoteBody s={s} />}
        </div>
      </div>
    </div>
  );
}

type Of<K extends Signal['kind']> = Extract<Signal, { kind: K }>;

// ── Commit ──────────────────────────────────────────────────────────────────

function CommitHead({ s }: { s: Of<'commit'> }) {
  return (
    <>
      <div className="signal__title">{s.message}</div>
      <div className="signal__meta">
        <span><b>{s.repo}</b></span>
        <span>{s.branch}</span>
        {s.hash && <span className="hash">{s.hash}</span>}
        {s.meta && <span>{s.meta}</span>}
      </div>
    </>
  );
}

const GH_USERNAME = 'Mola-maker';

function CommitBody({ s }: { s: Of<'commit'> }) {
  const repoUrl = `https://github.com/${GH_USERNAME}/${s.repo}`;
  const diffUrl = s.hash ? `${repoUrl}/commit/${s.hash}` : repoUrl;
  const files = s.files ?? [];
  const diff = s.diff ?? '';

  return (
    <div className="commit-body">
      {files.length > 0 && (
        <div className="commit-body__files">
          {files.map((f, i) => (
            <div key={i} className="commit-file">
              <span className="commit-file__path">{f.path}</span>
              <span className="commit-file__bar">
                <i className="plus" style={{ flex: f.plus }}></i>
                <i className="minus" style={{ flex: f.minus }}></i>
              </span>
              <span className="commit-file__meta">
                <span className="plus">+{f.plus}</span> <span className="minus">−{f.minus}</span>
              </span>
            </div>
          ))}
        </div>
      )}
      {diff && (
        <pre className="commit-body__diff">
          {diff.split('\n').map((line, i) => {
            const cls = line.startsWith('+') ? 'plus' : line.startsWith('-') ? 'minus' : line.startsWith('@') ? 'hunk' : '';
            return <div key={i} className={cls}>{line}</div>;
          })}
        </pre>
      )}
      <div className="commit-body__actions">
        <a href={diffUrl} target="_blank" rel="noopener noreferrer" className="commit-link">
          view on GitHub ↗
        </a>
        <a href={repoUrl} target="_blank" rel="noopener noreferrer" className="commit-link commit-link--ghost">
          open repo ↗
        </a>
        {s.issue && (
          <span className="commit-body__issue">
            resolves <b>{s.issue}</b>
          </span>
        )}
      </div>
    </div>
  );
}

// ── Song ────────────────────────────────────────────────────────────────────

function SongHead({ s }: { s: Of<'song'> }) {
  const [liveTime, setLiveTime] = useState(0);
  const [liveDuration, setLiveDuration] = useState(0);
  const [isNow, setIsNow] = useState(false);
  useEffect(() => {
    const handler = (e: Event) => {
      const { time, duration } = (e as CustomEvent<{ time: number; duration?: number }>).detail;
      setLiveTime(time);
      if (duration && duration > 0) setLiveDuration(duration);
    };
    window.addEventListener('mola:time-update', handler);
    return () => window.removeEventListener('mola:time-update', handler);
  }, []);
  useEffect(() => {
    const handler = (e: Event) => {
      const { id: playingId, playing } = (e as CustomEvent<{ id: number; playing: boolean }>).detail;
      const rawId = String((s as Record<string, unknown>).id ?? '');
      const neId = rawId.startsWith('song-') ? rawId.slice(5) : rawId;
      setIsNow(Number(neId) === playingId && playing);
    };
    window.addEventListener('mola:now-playing', handler);
    return () => window.removeEventListener('mola:now-playing', handler);
  }, [s]);
  const progress = liveDuration > 0 ? liveTime / liveDuration : (s.progress ?? 0.42);
  const fmt = (sec: number) => !isFinite(sec) ? '--:--' : `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
  const timeStr = liveDuration > 0 ? `${fmt(liveTime)} / ${fmt(liveDuration)}` : `${s.position} / ${s.length}`;
  return (
    <>
      <div className="signal__title song-title-line">
        {isNow && (
          <>
            <span className="song-wave-bars" aria-hidden="true">
              {[1, 2, 3, 4, 5].map((_, i) => <i key={i} style={{ animationDelay: `${i * 110}ms` }} />)}
            </span>
            <span className="song-now-tag">NOW</span>
          </>
        )}
        <em>{s.title}</em>
      </div>
      <div className="song-mini">
        <div className="cover" style={s.cover ? { backgroundImage: `url(${s.cover})` } : {}}>
          {!s.cover && <span aria-hidden="true">♫</span>}
        </div>
        <div className="song-mini__info">
          <div><b>{s.title}</b></div>
          <div style={{ color: 'var(--ink-soft)' }}>{s.artist} — {s.album}</div>
        </div>
        <div className="song-mini__progress">
          <i style={{ width: `${progress * 100}%` }}></i>
        </div>
        <div className="song-mini__time" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {timeStr}
        </div>
      </div>
    </>
  );
}

function SongBody({ s }: { s: Of<'song'> }) {
  const lyricsPreview = ((s as Record<string, unknown>).lyricsPreview as Array<{ time: number; text: string }> | undefined) ?? [];
  const rawId = String((s as Record<string, unknown>).id ?? '');
  const neId = rawId.startsWith('song-') ? rawId.slice(5) : rawId;

  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      setCurrentTime((e as CustomEvent<{ time: number }>).detail.time);
    };
    window.addEventListener('mola:time-update', handler);
    return () => window.removeEventListener('mola:time-update', handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const { id: playingId, playing } = (e as CustomEvent<{ id: number; playing: boolean }>).detail;
      setIsPlaying(Number(neId) === playingId && playing);
    };
    window.addEventListener('mola:now-playing', handler);
    return () => window.removeEventListener('mola:now-playing', handler);
  }, [neId]);

  // Last lyric line whose timestamp is <= currentTime
  const activeIdx = lyricsPreview.reduce((acc, line, i) => (line.time <= currentTime ? i : acc), -1);

  useEffect(() => {
    if (!listRef.current || activeIdx < 0) return;
    const li = listRef.current.children[activeIdx] as HTMLElement | undefined;
    li?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeIdx]);

  const toggleSong = () => {
    if (!neId) return;
    if (isPlaying) {
      window.dispatchEvent(new CustomEvent('mola:pause-song'));
    } else {
      window.dispatchEvent(new CustomEvent('mola:play-song', { detail: { id: Number(neId), title: s.title, artist: s.artist } }));
    }
  };

  return (
    <div className="song-body">
      {/* Spinning vinyl record with play button */}
      <div className="vinyl-wrap">
        <div className="vinyl-disc">
          <div
            className="vinyl-label"
            style={s.cover ? { backgroundImage: `url(${s.cover})` } : {}}
          />
          <div className="vinyl-shine" />
        </div>
        <div className="vinyl-arm" aria-hidden="true" />
        <div className="vinyl-base" />
        {neId && (
          <button
            className={`vinyl-play-btn${isPlaying ? ' is-playing' : ''}`}
            onClick={toggleSong}
            title={isPlaying ? 'Pause' : 'Play in music player'}
          >
            {isPlaying ? '❙❙' : '▶'}
          </button>
        )}
      </div>

      {/* Meta + lyrics in a 2-col grid */}
      <div className="song-body__right">
        <div className="song-body__meta">
          <div className="row"><span className="k">artist</span><span className="v">{s.artist}</span></div>
          <div className="row"><span className="k">album</span><span className="v">{s.album}</span></div>
          {s.bpm > 0 && <div className="row"><span className="k">bpm</span><span className="v">{s.bpm}</span></div>}
          <div className="row"><span className="k">key</span><span className="v">{s.key}</span></div>
          <div className="row"><span className="k">mood</span><span className="v">{s.mood}</span></div>
          <div className="row"><span className="k">length</span><span className="v">{s.length}</span></div>
          <div className="row"><span className="k">source</span><span className="v">netease fm</span></div>
        </div>

        {lyricsPreview.length > 0 && (
          <div className="song-body__lyrics">
            <div className="eyebrow" style={{ marginBottom: 8 }}>lyrics</div>
            <ol className="lrc-list" ref={listRef}>
              {lyricsPreview.map((line, i) => (
                <li key={i} className={i === activeIdx ? 'lrc-active' : ''}>
                  {line.text}
                </li>
              ))}
            </ol>
          </div>
        )}

        {(s.recent ?? []).length > 0 && (
          <div className="song-body__recent">
            <div className="eyebrow" style={{ marginBottom: 8 }}>recently played</div>
            <ul>
              {(s.recent ?? []).map((r, i) => (
                <li key={i}>
                  <span className="num">0{i + 1}</span>
                  <span className="t">{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Post ────────────────────────────────────────────────────────────────────

function PostHead({ s }: { s: Of<'post'> }) {
  return (
    <>
      <div className="signal__title">{s.title}</div>
      <div className="signal__meta">
        <span>{s.tag}</span>
        <span>{s.meta}</span>
        <span>{s.words} words</span>
      </div>
    </>
  );
}

function PostBody({ s, locale }: { s: Of<'post'>; locale: Locale }) {
  const [counts, setCounts] = useState({
    heart: s.reactions?.heart ?? 0,
    brain: s.reactions?.brain ?? 0,
    fire: s.reactions?.fire ?? 0,
  });
  const [voted, setVoted] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Fetch real counts on mount
  useEffect(() => {
    if (!s.slug) return;
    fetch(`/api/posts/react?slug=${encodeURIComponent(s.slug)}`)
      .then((r) => r.json())
      .then((json: { data?: { counts: Record<string, number> } }) => {
        if (json.data?.counts) {
          setCounts(json.data.counts as { heart: number; brain: number; fire: number });
        }
      })
      .catch(() => {});
  }, [s.slug]);

  const react = async (kind: string) => {
    if (busy || voted) return;
    setBusy(true);
    // Optimistic update
    setCounts((prev) => ({ ...prev, [kind]: (prev[kind as keyof typeof prev] ?? 0) + 1 }));
    setVoted(kind);
    try {
      const r = await fetch('/api/posts/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: s.slug, kind }),
      });
      const json = await r.json() as { data?: { counts: Record<string, number> } };
      if (json.data?.counts) {
        setCounts(json.data.counts as { heart: number; brain: number; fire: number });
      }
    } catch {
      // revert
      setCounts((prev) => ({ ...prev, [kind]: Math.max(0, (prev[kind as keyof typeof prev] ?? 1) - 1) }));
      setVoted(null);
    } finally {
      setBusy(false);
    }
  };

  const total = counts.heart + counts.brain + counts.fire;

  const reacts = [
    { kind: 'heart', emoji: '❤', label: 'heart' },
    { kind: 'brain', emoji: '⚙', label: 'brain' },
    { kind: 'fire', emoji: '✦', label: 'fire' },
  ];

  return (
    <div className="post-body">
      <div className="post-body__excerpt">{s.excerpt}</div>
      <div className="post-body__columns">
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            contents
          </div>
          <ol className="post-body__toc">
            {(s.toc ?? []).map((h, i) => (
              <li key={i}>
                <span className="num">§{i + 1}</span> {h}
              </li>
            ))}
          </ol>
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            reactions · {total}
          </div>
          <div className="post-body__reacts">
            {reacts.map(({ kind, emoji }) => (
              <button
                key={kind}
                className={`react${voted === kind ? ' voted' : ''}`}
                onClick={() => react(kind)}
                disabled={busy || voted !== null}
                aria-pressed={voted === kind}
                title={kind}
              >
                <span className="emoji">{emoji}</span>
                {counts[kind as keyof typeof counts] ?? 0}
              </button>
            ))}
          </div>
          <a href={`/${locale}/blog/${s.slug}`} className="btn btn--ripple btn--solid btn--arrow" data-magnet>
            read post
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Guestbook ───────────────────────────────────────────────────────────────

function GuestHead({ s }: { s: Of<'guestbook'> }) {
  const initials = s.name.charAt(0).toUpperCase();
  return (
    <>
      <div className="signal__title guest-title-line">
        <span className="gb-avatar" style={{ background: s.accent }}>{initials}</span>
        <span>{s.name}</span>
        <span className="gb-country">{s.country}</span>
      </div>
      <div className="quote">{s.message}</div>
    </>
  );
}

function GuestBody({ s }: { s: Of<'guestbook'> }) {
  return (
    <div className="guest-body">
      <div className="guest-body__card" style={{ borderColor: s.accent }}>
        {/* Ambient color glow */}
        <div className="guest-body__glow" style={{ background: s.accent }} />
        <div className="gb-avatar-lg" style={{ background: s.accent }}>
          {s.name.charAt(0).toUpperCase()}
        </div>
        <div className="guest-body__content">
          <div className="quote big">{s.message}</div>
          <div className="meta">
            <div className="who">
              — {s.name} &nbsp;<span style={{ opacity: 0.7 }}>{s.country}</span>
            </div>
            <div className="actions">
              <AButton kind="arrow" ghost>reply</AButton>
              <AButton kind="arrow" ghost>thank ↗</AButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Visitor ─────────────────────────────────────────────────────────────────

function VisitorHead({ s }: { s: Of<'visitor'> }) {
  const v = String(s.value ?? 0);
  return (
    <>
      <div className="visitor-live-row">
        <span className="visitor-live-badge">
          <span className="pulse-dot" />
          LIVE
        </span>
        <span className="visitor-head-label">
          {s.today ?? 0} visitors today
        </span>
      </div>
      <div className="odometer signal--visitor">
        {v.split('').map((c, i) => (
          <span key={i}>{c}</span>
        ))}
      </div>
      <div className="signal__body">total visitors. Welcome to the small.</div>
    </>
  );
}

function VisitorBody({ s }: { s: Of<'visitor'> }) {
  const pct = Math.min(100, Math.round(((s.today ?? 0) / 400) * 100));
  return (
    <div className="visitor-body">
      <div className="row"><span className="k">today</span><span className="v">{s.today ?? 0}</span></div>
      <div className="row"><span className="k">this week</span><span className="v">{(s.week ?? 0).toLocaleString()}</span></div>
      <div className="row"><span className="k">all time</span><span className="v">{(s.value ?? 0).toLocaleString()}</span></div>
      <div className="visitor-bars">
        <div className="visitor-bar-row">
          <span className="visitor-bar-label">today</span>
          <div className="visitor-bar">
            <i style={{ width: `${pct}%`, background: 'var(--accent)' }}></i>
          </div>
          <span className="visitor-bar-pct">{pct}%</span>
        </div>
        <div className="visitor-bar-row">
          <span className="visitor-bar-label">week</span>
          <div className="visitor-bar">
            <i style={{ width: `${Math.min(100, Math.round(((s.week ?? 0) / 3000) * 100))}%`, background: 'oklch(68% 0.12 75)' }}></i>
          </div>
          <span className="visitor-bar-pct">{Math.min(100, Math.round(((s.week ?? 0) / 3000) * 100))}%</span>
        </div>
      </div>
    </div>
  );
}

// ── Learning ────────────────────────────────────────────────────────────────

function LearningHead({ s }: { s: Of<'learning'> }) {
  const pct = Math.round((s.depth ?? 0) * 100);
  return (
    <>
      <div className="signal__title learning-title-line">
        <LearningRing pct={pct} />
        <span>{s.value}</span>
      </div>
      <div className="signal__body">
        <div className="learning-progress">
          <span>depth</span>
          <span className="bar">
            <i style={{ width: `${pct}%` }} />
          </span>
          <span>{pct}%</span>
        </div>
      </div>
    </>
  );
}

function LearningRing({ pct }: { pct: number }) {
  const r = 14;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg className="learn-ring" width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
      <circle cx="18" cy="18" r={r} fill="none" stroke="var(--rule)" strokeWidth="2.5" />
      <circle
        cx="18" cy="18" r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.5"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 18 18)"
        style={{ transition: 'stroke-dasharray 1s var(--ease-out-quart)' }}
      />
      <text x="18" y="22" textAnchor="middle" fontSize="9" fill="var(--ink-soft)" fontFamily="var(--font-mono)">
        {pct}
      </text>
    </svg>
  );
}

function LearningBody({ s }: { s: Of<'learning'> }) {
  return (
    <div className="learning-body">
      <div className="learning-body__source">
        <div className="eyebrow">source</div>
        <div className="val">{s.source}</div>
        <div className="learn-ring-lg">
          <LearningRing pct={Math.round((s.depth ?? 0) * 100)} />
        </div>
      </div>
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          notes
        </div>
        <ul className="learning-body__notes">
          {(s.notes ?? []).map((n, i) => (
            <li key={i}>
              <span className="bullet">→</span>
              {n}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── Deploy / Note ────────────────────────────────────────────────────────────

function DeployHead({ s }: { s: Of<'deploy'> }) {
  return (
    <>
      <div className="signal__title">Deploy &mdash; <em>{s.env}</em></div>
      <div className="signal__meta">
        <span className={"tag " + (s.status === 'ok' ? 'tag-ok' : 'tag-fail')}>{s.status}</span>
        <span>{s.version}</span>
      </div>
    </>
  );
}

function DeployBody({ s }: { s: Of<'deploy'> }) {
  return (
    <div className="deploy-body">
      <div className="deploy-body__detail">
        <div className="row"><span className="k">environment</span><span className="v">{s.env}</span></div>
        <div className="row"><span className="k">version</span><span className="v">{s.version}</span></div>
        <div className="row"><span className="k">status</span><span className="v" style={{ color: s.status === 'ok' ? 'var(--accent)' : 'var(--red)' }}>{s.status}</span></div>
      </div>
    </div>
  );
}

function NoteHead({ s }: { s: Of<'note'> }) {
  return (
    <div className="signal__title"><span style={{ opacity: 0.5 }}>&#x270E;</span> {s.text.slice(0, 60)}{s.text.length > 60 ? '...' : ''}</div>
  );
}

function NoteBody({ s }: { s: Of<'note'> }) {
  return (
    <div className="note-body">
      <div className="note-body__text">{s.text}</div>
    </div>
  );
}
