// Miku's atelier — the motifs she knows how to paint, and the gallery shelf
// they land on. Each motif is a list of polyline strokes in a 0–100 viewBox;
// the fairy literally flies along these points with a brush (miku-fairy.tsx),
// and the magazine gallery (mag-gallery.tsx) re-renders finished pieces as
// crisp inline SVGs from the same data. localStorage is the museum archive.

export interface PaintStroke {
  color: string;
  width?: number;
  pts: Array<[number, number]>;
}

export interface PaintMotif {
  id: string;
  title: { en: string; zh: string };
  strokes: PaintStroke[];
}

export interface GalleryItem {
  id: string;
  motif: string;
  ts: number;
}

const GALLERY_KEY = 'mola:miku-gallery';
const GALLERY_CAP = 12;

// ── stroke geometry helpers ─────────────────────────────────────────────────

const rnd2 = (n: number) => Math.round(n * 100) / 100;

function ring(cx: number, cy: number, r: number, n = 18, phase = -Math.PI / 2): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= n; i++) {
    const a = phase + (Math.PI * 2 * i) / n;
    pts.push([rnd2(cx + Math.cos(a) * r), rnd2(cy + Math.sin(a) * r)]);
  }
  return pts;
}

function heartPts(cx: number, cy: number, s: number, n = 26): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= n; i++) {
    const t = (Math.PI * 2 * i) / n;
    pts.push([
      rnd2(cx + 16 * Math.sin(t) ** 3 * s),
      rnd2(cy - (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * s),
    ]);
  }
  return pts;
}

function starPts(cx: number, cy: number, rOuter: number, rInner: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= 10; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = -Math.PI / 2 + (Math.PI * i) / 5;
    pts.push([rnd2(cx + Math.cos(a) * r), rnd2(cy + Math.sin(a) * r)]);
  }
  return pts;
}

/** A petal: a slim loop pointing outward from (cx,cy) at `angle`. */
function petal(cx: number, cy: number, angle: number, len: number, w: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= 12; i++) {
    const t = (Math.PI * 2 * i) / 12;
    const px = (Math.cos(t) * 0.5 + 0.5) * len;       // 0..len along the petal
    const py = Math.sin(t) * w * Math.sin((px / len) * Math.PI); // pinched ends
    pts.push([
      rnd2(cx + Math.cos(angle) * px - Math.sin(angle) * py),
      rnd2(cy + Math.sin(angle) * px + Math.cos(angle) * py),
    ]);
  }
  return pts;
}

// ── the repertoire ──────────────────────────────────────────────────────────

const TEAL = '#39c5bb';
const PINK = '#f0879a';
const GOLD = '#e8b33c';
const INK = '#3a3f46';
const GREEN = '#5fae57';

export const PAINT_MOTIFS: PaintMotif[] = [
  {
    id: 'heart',
    title: { en: 'A Heart, For You', zh: '送你一颗心' },
    strokes: [
      { color: PINK, width: 3, pts: heartPts(50, 52, 2.6) },
      { color: TEAL, width: 2, pts: [[20, 22], [24, 16], [28, 22]] },
      { color: GOLD, width: 2, pts: [[76, 20], [80, 26], [84, 20]] },
    ],
  },
  {
    id: 'star',
    title: { en: 'Stage Light', zh: '舞台之星' },
    strokes: [
      { color: GOLD, width: 3, pts: starPts(50, 52, 34, 14) },
      { color: TEAL, width: 2, pts: [[16, 24], [20, 18], [24, 24]] },
      { color: PINK, width: 2, pts: [[78, 76], [82, 70], [86, 76]] },
    ],
  },
  {
    id: 'note',
    title: { en: 'First Sound', zh: '初音' },
    strokes: [
      { color: TEAL, width: 4, pts: ring(38, 74, 9, 14) },
      { color: TEAL, width: 3, pts: [[47, 72], [47, 24]] },
      { color: TEAL, width: 3, pts: [[47, 24], [62, 30], [68, 40]] },
      { color: PINK, width: 2, pts: [[72, 60], [76, 54], [80, 60]] },
    ],
  },
  {
    id: 'leek',
    title: { en: 'The Sacred Leek', zh: '神圣的大葱' },
    strokes: [
      { color: '#eef3e4', width: 5, pts: [[50, 88], [50, 52]] },
      { color: GREEN, width: 4, pts: [[50, 52], [46, 30], [34, 14]] },
      { color: GREEN, width: 4, pts: [[50, 52], [54, 30], [68, 12]] },
      { color: GREEN, width: 3, pts: [[50, 52], [50, 26]] },
    ],
  },
  {
    id: 'cat',
    title: { en: 'Neighbourhood Cat', zh: '路口的猫' },
    strokes: [
      { color: INK, width: 3, pts: ring(50, 56, 26, 22) },
      { color: INK, width: 3, pts: [[30, 38], [26, 20], [42, 32]] },
      { color: INK, width: 3, pts: [[70, 38], [74, 20], [58, 32]] },
      { color: INK, width: 2.5, pts: [[41, 52], [41, 57]] },
      { color: INK, width: 2.5, pts: [[59, 52], [59, 57]] },
      { color: PINK, width: 2.5, pts: [[46, 66], [50, 69], [54, 66]] },
      { color: INK, width: 1.6, pts: [[18, 58], [34, 61]] },
      { color: INK, width: 1.6, pts: [[18, 68], [34, 66]] },
      { color: INK, width: 1.6, pts: [[82, 58], [66, 61]] },
      { color: INK, width: 1.6, pts: [[82, 68], [66, 66]] },
    ],
  },
  {
    id: 'sakura',
    title: { en: 'Petal Study', zh: '樱花习作' },
    strokes: [
      { color: PINK, width: 2.5, pts: petal(50, 50, -Math.PI / 2, 30, 9) },
      { color: PINK, width: 2.5, pts: petal(50, 50, -Math.PI / 2 + (Math.PI * 2) / 5, 30, 9) },
      { color: PINK, width: 2.5, pts: petal(50, 50, -Math.PI / 2 + (Math.PI * 4) / 5, 30, 9) },
      { color: PINK, width: 2.5, pts: petal(50, 50, -Math.PI / 2 + (Math.PI * 6) / 5, 30, 9) },
      { color: PINK, width: 2.5, pts: petal(50, 50, -Math.PI / 2 + (Math.PI * 8) / 5, 30, 9) },
      { color: GOLD, width: 3, pts: ring(50, 50, 4, 10) },
    ],
  },
  {
    id: 'mola',
    title: { en: 'Mola mola!', zh: '翻车鱼!' },
    strokes: [
      { color: TEAL, width: 3, pts: ring(46, 52, 26, 22) },
      { color: TEAL, width: 3, pts: [[68, 36], [84, 30], [80, 44]] },
      { color: TEAL, width: 3, pts: [[68, 68], [84, 74], [80, 60]] },
      { color: INK, width: 3, pts: ring(38, 46, 2.5, 8) },
      { color: PINK, width: 2, pts: [[30, 60], [38, 63], [46, 60]] },
      { color: TEAL, width: 1.6, pts: ring(82, 16, 3, 8) },
      { color: TEAL, width: 1.6, pts: ring(88, 26, 2, 8) },
    ],
  },
  {
    id: 'smile',
    title: { en: 'Today Was Good', zh: '今天也不错' },
    strokes: [
      { color: GOLD, width: 3, pts: ring(50, 50, 30, 24) },
      { color: INK, width: 3.5, pts: [[39, 42], [39, 48]] },
      { color: INK, width: 3.5, pts: [[61, 42], [61, 48]] },
      { color: PINK, width: 3, pts: [[36, 60], [44, 68], [56, 68], [64, 60]] },
    ],
  },
];

export function motifById(id: string): PaintMotif | undefined {
  return PAINT_MOTIFS.find((m) => m.id === id);
}

export function randomMotif(excludeId?: string): PaintMotif {
  const pool = PAINT_MOTIFS.filter((m) => m.id !== excludeId);
  return pool[Math.floor(Math.random() * pool.length)] ?? PAINT_MOTIFS[0];
}

// ── gallery archive (localStorage) ──────────────────────────────────────────

export function loadGallery(): GalleryItem[] {
  try {
    const raw = localStorage.getItem(GALLERY_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw) as GalleryItem[];
    return items.filter((i) => i && typeof i.motif === 'string' && motifById(i.motif));
  } catch {
    return [];
  }
}

function persist(items: GalleryItem[]): void {
  try {
    localStorage.setItem(GALLERY_KEY, JSON.stringify(items.slice(0, GALLERY_CAP)));
    window.dispatchEvent(new CustomEvent('miku:gallery-update'));
  } catch { /* storage disabled */ }
}

export function saveGalleryItem(motifId: string): GalleryItem {
  const item: GalleryItem = {
    id: `pt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    motif: motifId,
    ts: Date.now(),
  };
  persist([item, ...loadGallery()]);
  return item;
}

export function removeGalleryItem(id: string): void {
  persist(loadGallery().filter((i) => i.id !== id));
}
