'use client';

// Variant C: Atlas — ported from v-atlas.jsx. Draggable zone pins with
// subtree-explode topology, background Miku video/gif overlay.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { I18nBlock, Locale, Post, Guest, Repo } from './data';
import { molaData } from './data';
import { AButton, useReveal } from './atoms';
import { FluidText } from './fluid-text';
import { assetUrl } from '@/lib/asset-url';

type Props = {
  t: I18nBlock;
  locale: Locale;
  bgOpacity?: number;
  bgSrc?: string;
  posts?: Post[];
  guestbook?: Guest[];
  repos?: Repo[];
};

type Pos = { x: number; y: number };

export function VAtlas({ t, locale, bgOpacity = 0.18, bgSrc, posts, guestbook, repos }: Props) {
  // Fall back to bundled data when a live list is missing OR empty —
  // downstream code dereferences posts[0]/repos[0], which crashes on [].
  const d = {
    ...molaData,
    posts: posts && posts.length ? posts : molaData.posts,
    guestbook: guestbook ?? molaData.guestbook,
    repos: repos && repos.length ? repos : molaData.repos,
  };
  const [active, setActive] = useState<string>('writing');
  const [exploded, setExploded] = useState<string | null>(null);
  const [positions, setPositions] = useState<Record<string, Pos>>(() =>
    Object.fromEntries(d.zones.map((z) => [z.id, { x: z.x, y: z.y }])),
  );
  const [dragging, setDragging] = useState<string | null>(null);
  const draggingRef = useRef<{ id: string; moved: boolean; startX: number; startY: number } | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  useReveal(locale);

  useEffect(() => {
    const reset = () => {
      setPositions(Object.fromEntries(d.zones.map((z) => [z.id, { x: z.x, y: z.y }])));
      setExploded(null);
    };
    window.addEventListener('atlas:reset', reset);
    return () => window.removeEventListener('atlas:reset', reset);
  }, [d.zones]);

  const onPointerDown = (id: string) => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = { id, moved: false, startX: e.clientX, startY: e.clientY };
    setDragging(id);
    setActive(id);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };
  const onPointerMove = (id: string) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current || draggingRef.current.id !== id) return;
    const dx = Math.abs(e.clientX - draggingRef.current.startX);
    const dy = Math.abs(e.clientY - draggingRef.current.startY);
    if (dx > 3 || dy > 3) draggingRef.current.moved = true;
    if (!mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const x = Math.max(4, Math.min(96, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(8, Math.min(94, ((e.clientY - rect.top) / rect.height) * 100));
    setPositions((p) => ({ ...p, [id]: { x, y } }));
  };
  const onPointerUp = (id: string) => (e: React.PointerEvent<HTMLButtonElement>) => {
    const wasDrag = draggingRef.current?.moved;
    if (draggingRef.current?.id === id) {
      draggingRef.current = null;
      setDragging(null);
      if (!wasDrag) {
        setExploded((cur) => (cur === id ? null : id));
      }
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const detailFor = (id: string) => {
    if (id === 'writing')
      return {
        title: locale === 'zh' ? '文章' : 'Writing',
        meta: [
          ['entries', d.posts.length],
          ['since', '2024'],
          ['last', d.posts[0].date],
        ] as [string, string | number][],
        items: d.posts.map((p) => ({ date: p.date, title: p.title, meta: `${p.readTime} min`, href: `/${locale}/blog/${p.slug}` })),
      };
    if (id === 'work')
      return {
        title: locale === 'zh' ? '作品' : 'Work',
        meta: [
          ['shipped', 11],
          ['ongoing', 3],
          ['stack', 'TS · Rust · CUDA'],
        ] as [string, string | number][],
        items: [
          { date: '2026', title: 'AstrBot plugin suite', meta: 'TypeScript', href: 'https://github.com/Mola-maker/astrbot-plugins' },
          { date: '2026', title: 'kernel-notes — CUDA sketchbook', meta: 'CUDA', href: 'https://github.com/Mola-maker/kernel-notes' },
          { date: '2025', title: 'gstack — ECC playground', meta: 'Rust', href: 'https://github.com/Mola-maker/gstack' },
          { date: '2025', title: 'OMC — minimal compiler', meta: 'OCaml', href: 'https://github.com/Mola-maker/omc' },
        ],
      };
    if (id === 'open')
      return {
        title: locale === 'zh' ? '开源' : 'Open source',
        meta: [
          ['repos', d.repos.length],
          ['stars', d.repos.reduce((s, r) => s + r.stars, 0)],
          ['last commit', '2h ago'],
        ] as [string, string | number][],
        items: d.repos.map((r) => ({ date: r.lang, title: r.name, meta: `★ ${r.stars}`, href: `https://github.com/Mola-maker/${r.name}` })),
      };
    if (id === 'now')
      return {
        title: locale === 'zh' ? '此刻' : 'Now',
        meta: [
          ['playing', d.nowPlaying.title],
          ['learning', d.status.learning],
          ['weather', d.status.weather],
        ] as [string, string | number][],
        items: [
          { date: 'mood', title: 'cautiously optimistic', meta: '— mola', href: `/${locale}` },
          { date: 'desk', title: locale === 'zh' ? d.status.locationCn : d.status.location, meta: d.status.tz, href: `/${locale}` },
          { date: 'fuel', title: 'jasmine tea, hot', meta: '2nd pot', href: `/${locale}` },
          { date: 'reading', title: '"The Inner Game of Tennis"', meta: 'p. 84', href: `/${locale}` },
        ],
      };
    if (id === 'chat')
      return {
        title: locale === 'zh' ? '聊天' : 'Talk',
        meta: [
          ['mode', 'haiku-4-5'],
          ['vibe', 'late-night'],
          ['latency', '~600ms'],
        ] as [string, string | number][],
        items: [
          { date: 'today', title: 'Tell me about CUDA shared memory', meta: '12 turns', href: `/${locale}#chat` },
          { date: 'today', title: 'What did you ship this week?', meta: '6 turns', href: `/${locale}#chat` },
          { date: 'today', title: 'Recommend a serif for code annotations', meta: '4 turns', href: `/${locale}#chat` },
          { date: '— ', title: 'You can ask the bot live →', meta: 'try it', href: `/${locale}#chat` },
        ],
      };
    return {
      title: locale === 'zh' ? '留言' : 'Guests',
      meta: [
        ['notes', d.guestbook.length],
        ['this week', 18],
        ['since', '2024'],
      ] as [string, string | number][],
      items: d.guestbook.map((g) => ({
        date: g.t,
        title: `${g.name} — ${g.message.slice(0, 48)}…`,
        meta: '',
        href: `/${locale}#guestbook`,
      })),
    };
  };
  const detail = detailFor(active);

  const pairs: [string, string][] = [
    ['writing', 'now'], ['writing', 'guest'],
    ['work', 'open'], ['work', 'now'],
    ['now', 'chat'], ['now', 'guest'],
    ['open', 'now'], ['chat', 'guest'], ['writing', 'work'],
  ];

  const stars = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        x: (i * 53 + 17) % 100,
        y: (i * 71 + 11) % 100,
        s: ((i * 17) % 4) + 1,
        d: ((i * 31) % 6) + 2,
      })),
    [],
  );

  const subtree = exploded ? (d.atlas_subtrees as Record<string, { id: string; label: string; meta: string }[]>)[exploded] || [] : [];
  const center = exploded ? positions[exploded] : null;
  const subPositions = useMemo(() => {
    if (!center) return [] as { id: string; label: string; meta: string; x: number; y: number }[];
    const r = 18;
    return subtree.map((node, i) => {
      const angle = (i / subtree.length) * Math.PI * 2 - Math.PI / 2;
      let x = center.x + Math.cos(angle) * r;
      let y = center.y + Math.sin(angle) * r * 1.4;
      x = Math.max(4, Math.min(96, x));
      y = Math.max(8, Math.min(94, y));
      return { ...node, x, y };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exploded, center?.x, center?.y, subtree.length]);

  return (
    <div className="v-atlas">
      <div className="wrap" id="top">
        <section className="atlas-hero has-backdrop">
          <div className="miku-backdrop"></div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 22 }}>
              {t.eyebrow} · {locale === 'zh' ? '地图模式' : 'atlas mode'}
            </div>
            <h1>
              {locale === 'zh' ? (
                <>
                  <FluidText text="这里有几片" />
                  <em>
                    {' '}
                    <FluidText text="安静" delay={5} />{' '}
                  </em>
                  <FluidText text="的领地。" delay={7} />
                </>
              ) : (
                <>
                  <FluidText text="A small " />
                  <em>
                    <FluidText text="atlas" delay={2} />
                  </em>
                  <FluidText text=" of quiet territories." delay={3} />
                </>
              )}
            </h1>
            <p>{t.lead}</p>
            <div className="atlas-hint">
              <span className="dot"></span>
              {locale === 'zh'
                ? '拖动标记或点击展开子树 · 双击复位'
                : 'drag pins to rearrange · click to explode subtree · double-click resets'}
            </div>
          </div>
          <div className="atlas-hero__legend reveal">
            <div className="row"><span className="k">scale</span><span className="v">1 : 64</span></div>
            <div className="row"><span className="k">projection</span><span className="v">flatpaper</span></div>
            <div className="row"><span className="k">surveyed</span><span className="v">{new Date().toLocaleDateString()}</span></div>
            <div className="row"><span className="k">zones</span><span className="v">{d.zones.length}</span></div>
            <div className="row"><span className="k">crossings</span><span className="v">{pairs.length}</span></div>
            <div className="row">
              <span className="k">state</span>
              <span className="v">{dragging ? '· dragging' : exploded ? `· explored: ${exploded}` : '· settled'}</span>
            </div>
          </div>
        </section>

        <div
          className="map reveal"
          id="sec-2"
          ref={mapRef}
          onDoubleClick={() => {
            setPositions(Object.fromEntries(d.zones.map((z) => [z.id, { x: z.x, y: z.y }])));
            setExploded(null);
          }}
        >
          <div className="map__bg" style={{ opacity: bgOpacity }}>
            {bgSrc?.endsWith('.mp4') ? (
              <video src={bgSrc} autoPlay loop muted playsInline />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={bgSrc || assetUrl('/redesign/miku-bg-orbit.gif')} alt="" />
            )}
          </div>

          <div className="map__sparkles" aria-hidden="true">
            {stars.map((s, i) => (
              <span
                key={i}
                className="map__star"
                style={{
                  left: `${s.x}%`,
                  top: `${s.y}%`,
                  width: `${s.s}px`,
                  height: `${s.s}px`,
                  animationDelay: `${s.d}s`,
                }}
              />
            ))}
          </div>

          <svg className="map__svg" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="atlasLine" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--ink-faint)" stopOpacity="0.0" />
                <stop offset="50%" stopColor="var(--ink-faint)" stopOpacity="0.85" />
                <stop offset="100%" stopColor="var(--ink-faint)" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="atlasLineHot" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.0" />
                <stop offset="50%" stopColor="var(--accent)" stopOpacity="0.9" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            {!exploded &&
              pairs.map(([a, b], i) => {
                const za = positions[a];
                const zb = positions[b];
                if (!za || !zb) return null;
                const mx = (za.x + zb.x) / 2 + Math.sin(i) * 6;
                const my = (za.y + zb.y) / 2 + Math.cos(i) * 6;
                const hot = a === active || b === active;
                return (
                  <path
                    key={i}
                    d={`M ${za.x} ${za.y} Q ${mx} ${my} ${zb.x} ${zb.y}`}
                    stroke={hot ? 'url(#atlasLineHot)' : 'url(#atlasLine)'}
                    strokeWidth={hot ? 1.2 : 0.7}
                    strokeDasharray={hot ? '0' : '3 4'}
                    fill="none"
                  />
                );
              })}
            {exploded &&
              center &&
              subPositions.map((node, i) => (
                <path
                  key={`sub-${i}`}
                  d={`M ${center.x} ${center.y} L ${node.x} ${node.y}`}
                  stroke="url(#atlasLineHot)"
                  strokeWidth="1.4"
                  fill="none"
                  className="atlas-sub-edge"
                  style={{ animation: `subEdgeIn 500ms ${i * 60}ms var(--ease-out-quart) both` }}
                />
              ))}
          </svg>

          <div className="map__compass">✦</div>
          <div className="map__legend">
            <div>
              <span className="swatch" style={{ background: 'var(--accent)' }}></span> active zone
            </div>
            <div>
              <span className="swatch" style={{ background: 'var(--ink-faint)' }}></span> path
            </div>
            <div>
              <span className="swatch" style={{ background: 'var(--ink)' }}></span> outpost
            </div>
            {exploded && (
              <div style={{ marginTop: 4, color: 'var(--accent)' }}>
                subtree: {exploded} · {subtree.length} nodes
              </div>
            )}
            <div style={{ marginTop: 4, fontStyle: 'italic', color: 'var(--ink-soft)' }}>↺ double-click resets</div>
          </div>

          {d.zones.map((z) => {
            const p = positions[z.id];
            const isExploded = exploded === z.id;
            return (
              <button
                key={z.id}
                className={`zone ${active === z.id ? 'is-active' : ''} ${dragging === z.id ? 'is-dragging' : ''} ${isExploded ? 'is-exploded' : ''} ${exploded && !isExploded ? 'is-dimmed' : ''}`}
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                onPointerDown={onPointerDown(z.id)}
                onPointerMove={onPointerMove(z.id)}
                onPointerUp={onPointerUp(z.id)}
                onPointerCancel={onPointerUp(z.id)}
                onMouseEnter={() => !dragging && setActive(z.id)}
              >
                <span className="zone__pin"></span>
                <span className="zone__label">{z.label}</span>
                <span className="zone__count">
                  {z.count} · {z.hint}
                </span>
              </button>
            );
          })}

          {exploded &&
            subPositions.map((node, i) => (
              <div
                key={node.id}
                className="sub-node"
                style={{
                  left: `${node.x}%`,
                  top: `${node.y}%`,
                  animation: `subNodeIn 480ms ${100 + i * 70}ms var(--ease-out-expo) both`,
                }}
              >
                <span className="sub-node__pin"></span>
                <span className="sub-node__label">{node.label}</span>
                <span className="sub-node__meta">{node.meta}</span>
              </div>
            ))}
        </div>

        <section className="zone-detail reveal" id="sec-3">
          <div className="zone-detail__side">
            <div className="eyebrow" style={{ marginBottom: 16 }}>
              {locale === 'zh' ? '选中' : 'Selected'}
            </div>
            <h3>{detail.title}</h3>
            <div className="meta">
              {detail.meta.map(([k, v], i) => (
                <div className="row" key={i}>
                  <span className="k">{k}</span>
                  <span className="v">{v}</span>
                </div>
              ))}
            </div>
            <AButton
              kind="arrow"
              solid
              style={{ marginTop: 20 }}
              onClick={() => setExploded(exploded === active ? null : active)}
            >
              {exploded === active ? 'collapse subtree' : 'explode subtree'}
            </AButton>
          </div>
          <div className="zone-detail__body">
            {detail.items.map((it, i) => (
              <a
                key={i}
                href={it.href ?? `/${locale}`}
                className="zone-detail__item"
                data-magnet
                target={it.href?.startsWith('http') ? '_blank' : undefined}
                rel={it.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
              >
                <span className="date">{it.date}</span>
                <span className="title">{it.title}</span>
                <span className="meta">{it.meta}</span>
              </a>
            ))}
          </div>
        </section>

        <section className="atlas-strips reveal" id="sec-4">
          <div className="strip">
            <div className="strip__head">
              <span>now playing</span>
              <span className="pulse"></span>
            </div>
            <div className="strip__title">{d.nowPlaying.title}</div>
            <div className="strip__body">
              {d.nowPlaying.artist} — <em>{d.nowPlaying.album}</em>
            </div>
            <ul>
              <li><span className="k">progress</span><span className="v">42%</span></li>
              <li><span className="k">source</span><span className="v">spotify</span></li>
              <li><span className="k">mood</span><span className="v">soft / late</span></li>
            </ul>
          </div>
          <div className="strip">
            <div className="strip__head">
              <span>visitor</span>
              <span>#{d.visitor.toLocaleString()}</span>
            </div>
            <div className="strip__title">{locale === 'zh' ? '欢迎，旅人' : 'Welcome, traveler'}</div>
            <div className="strip__body">
              {locale === 'zh'
                ? '你是今天到访这片土地的第 12,473 位访客。'
                : 'You are visitor number 12,473 to this land.'}
            </div>
            <ul>
              <li><span className="k">today</span><span className="v">218</span></li>
              <li><span className="k">this week</span><span className="v">1,394</span></li>
              <li><span className="k">since</span><span className="v">2024-08</span></li>
            </ul>
          </div>
          <div className="strip">
            <div className="strip__head">
              <span>guestbook</span>
              <span>{d.guestbook.length} notes</span>
            </div>
            <div className="strip__title">{d.guestbook[0]?.name ?? '—'}</div>
            <div className="strip__body">&quot;{d.guestbook[0]?.message ?? '…'}&quot;</div>
            <ul>
              <li><span className="k">latest</span><span className="v">{d.guestbook[0]?.t ?? '—'}</span></li>
              <li><span className="k">accepting</span><span className="v">yes</span></li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
