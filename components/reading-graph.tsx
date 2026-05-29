'use client';

// Reading Graph — force-directed map of blog posts connected by shared tags.
// Pure canvas + requestAnimationFrame, no external graph lib needed.

import { useEffect, useRef, useState, useCallback } from 'react';

type PostNode = {
  slug: string;
  title: string;
  tag: string;
  read_time: number;
};

type Node = {
  id: string;
  label: string;
  tag: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
};

type Edge = { a: string; b: string; strength: number };

// Two posts are connected if they share the same tag.
function buildGraph(posts: PostNode[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = posts.map((p, i) => {
    const angle = (2 * Math.PI * i) / posts.length;
    const radius = 120;
    return {
      id: p.slug,
      label: p.title.slice(0, 28) + (p.title.length > 28 ? '…' : ''),
      tag: p.tag,
      x: 200 + radius * Math.cos(angle),
      y: 160 + radius * Math.sin(angle),
      vx: 0, vy: 0,
      r: Math.max(24, Math.min(36, 22 + p.read_time)),
    };
  });

  const edges: Edge[] = [];
  for (let i = 0; i < posts.length; i++) {
    for (let j = i + 1; j < posts.length; j++) {
      if (posts[i].tag === posts[j].tag) {
        edges.push({ a: posts[i].slug, b: posts[j].slug, strength: 1 });
      }
    }
  }
  return { nodes, edges };
}

// Tag → warm accent colour derived from tag string hash
const TAG_COLORS: Record<string, string> = {
  systems: '#C96442', cuda: '#5E6B8C', tooling: '#3E7C5F',
  notes: '#8A5A3B', tinkering: '#6B5E8C', agents: '#A04E30',
  gpu: '#4A7A8C', rust: '#7C5E3E', crypto: '#5C7C3E',
};
function tagColor(tag: string): string {
  return TAG_COLORS[tag] ?? '#8B816E';
}

const REPULSION   = 4500;
const SPRING_LEN  = 140;
const SPRING_K    = 0.04;
const DAMPING     = 0.88;
const CENTER_K    = 0.008;

export function ReadingGraph({ posts, locale }: { posts: PostNode[]; locale: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef  = useRef<Node[]>([]);
  const edgesRef  = useRef<Edge[]>([]);
  const rafRef    = useRef<number>(0);
  const hoveredRef = useRef<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const navigate = useCallback((slug: string) => {
    window.location.href = `/${locale}/blog/${slug}`;
  }, [locale]);

  useEffect(() => {
    if (posts.length < 2) return;
    const g = buildGraph(posts);
    nodesRef.current = g.nodes;
    edgesRef.current = g.edges;
  }, [posts]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || posts.length < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width  = W * devicePixelRatio;
    canvas.height = H * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);

    // Re-centre nodes on resize
    nodesRef.current.forEach((n) => {
      n.x = n.x * (W / 400);
      n.y = n.y * (H / 320);
    });

    function tick() {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const cx = W / 2, cy = H / 2;

      // Forces
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        // Repulsion between all node pairs
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy + 0.01;
          const f = REPULSION / d2;
          const fx = (dx / Math.sqrt(d2)) * f;
          const fy = (dy / Math.sqrt(d2)) * f;
          a.vx += fx; a.vy += fy;
          b.vx -= fx; b.vy -= fy;
        }
        // Gravity to centre
        a.vx += (cx - a.x) * CENTER_K;
        a.vy += (cy - a.y) * CENTER_K;
        // Damping
        a.vx *= DAMPING; a.vy *= DAMPING;
      }
      // Spring attraction along edges
      for (const e of edges) {
        const a = nodes.find((n) => n.id === e.a)!;
        const b = nodes.find((n) => n.id === e.b)!;
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
        const f = (d - SPRING_LEN) * SPRING_K * e.strength;
        a.vx += (dx / d) * f; a.vy += (dy / d) * f;
        b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
      }
      // Integrate + clamp to canvas
      for (const n of nodes) {
        n.x = Math.max(n.r + 4, Math.min(W - n.r - 4, n.x + n.vx));
        n.y = Math.max(n.r + 4, Math.min(H - n.r - 4, n.y + n.vy));
      }

      // Draw
      ctx.clearRect(0, 0, W, H);

      // Edges
      for (const e of edges) {
        const a = nodes.find((n) => n.id === e.a)!;
        const b = nodes.find((n) => n.id === e.b)!;
        if (!a || !b) continue;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = 'rgba(180, 162, 133, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Nodes
      for (const n of nodes) {
        const isHov = hoveredRef.current === n.id;
        const color = tagColor(n.tag);

        // Shadow / glow on hover
        if (isHov) {
          ctx.shadowBlur = 12;
          ctx.shadowColor = color;
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = isHov ? color : color + '33';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = isHov ? 2 : 1;
        ctx.stroke();

        ctx.shadowBlur = 0;

        // Label
        ctx.fillStyle = isHov ? '#FAF7F1' : color;
        ctx.font = `${isHov ? 600 : 400} 9px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const words = n.label.split(' ');
        // Wrap into ≤2 lines
        const line1 = words.slice(0, Math.ceil(words.length / 2)).join(' ');
        const line2 = words.slice(Math.ceil(words.length / 2)).join(' ');
        if (line2) {
          ctx.fillText(line1, n.x, n.y - 6, n.r * 1.7);
          ctx.fillText(line2, n.x, n.y + 6, n.r * 1.7);
        } else {
          ctx.fillText(line1, n.x, n.y, n.r * 1.7);
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [posts]);

  // Mouse interaction
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = nodesRef.current.find((n) => {
      const dx = n.x - mx, dy = n.y - my;
      return Math.sqrt(dx * dx + dy * dy) < n.r;
    });
    const id = hit?.id ?? null;
    hoveredRef.current = id;
    setHovered(id);
    canvas.style.cursor = id ? 'pointer' : 'default';
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = nodesRef.current.find((n) => {
      const dx = n.x - mx, dy = n.y - my;
      return Math.sqrt(dx * dx + dy * dy) < n.r;
    });
    if (hit) navigate(hit.id);
  }, [navigate]);

  if (posts.length < 2) return null;

  const hoveredPost = posts.find((p) => p.slug === hovered);

  return (
    <div style={{
      margin: '48px 0',
      border: '1px solid var(--rule)',
      borderRadius: 6,
      overflow: 'hidden',
      background: 'var(--bg-elev)',
      position: 'relative',
    }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--rule)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--ink-soft)',
        }}>
          Reading map · {posts.length} posts
        </span>
        {hoveredPost && (
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10.5,
            color: tagColor(hoveredPost.tag),
          }}>
            → {hoveredPost.title}
          </span>
        )}
      </div>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: 320 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { hoveredRef.current = null; setHovered(null); }}
        onClick={handleClick}
      />
      <div style={{
        padding: '8px 16px',
        borderTop: '1px solid var(--rule)',
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        {Array.from(new Set(posts.map((p) => p.tag))).map((tag) => (
          <span key={tag} style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9.5,
            color: tagColor(tag),
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: tagColor(tag), display: 'inline-block' }} />
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
