// GeoGebra construction → TikZ ("Magic!" export).
//
// Pure, deterministic, unit-testable: takes a serialisable snapshot of the live
// applet's construction (read in components/redesign/workplace-math.tsx via the
// applet JS API) and emits LaTeX in one of two styles the customer actually uses
// (distilled in docs/tikz-euclide-export.md):
//
//   'tkz' — tkz-euclide construction macros (the house style). Recognised GGB
//           commands map ~1:1 to \tkzDef…/\tkzInter…/\tkzDraw…; anything we can't
//           map falls back to a numeric \tkzDefPoint(x,y){Name} (always valid).
//   'raw' — absolute-coordinate \draw/\fill, mimicking GeoGebra's own
//           "Export → PGF/TikZ" output (colours, scriptsize dot+label).
//
// Both modes always produce compilable output: every point has numeric coords
// from the applet, so the numeric fallback can never fail.

export type TikzMode = 'tkz' | 'raw';

export interface GgbObject {
  name: string;
  /** getObjectType(): 'point' | 'segment' | 'line' | 'ray' | 'vector' | 'conic' | 'polygon' | 'numeric' | … */
  type: string;
  /** getCommandString() — the defining command, '' for free objects. */
  command: string;
  visible: boolean;
  /** point coords (getXcoord/getYcoord). */
  x?: number;
  y?: number;
  /** hex colour '#RRGGBB' (getColor), used by raw mode only. */
  color?: string;
  /** getLineThickness(). */
  thickness?: number;
  /** getLineStyle() !== 0. */
  dashed?: boolean;
  /** SetCaption text — the intended display label (defaults to the name). */
  caption?: string;
  /** ShowLabel(obj,false) → false; controls whether the point is labelled. */
  labelVisible?: boolean;
}

export interface TikzExportResult {
  code: string;
  /** short human note for the UI, e.g. "12 个对象 · 2 个回退为坐标". */
  note: string;
}

// ── small helpers ───────────────────────────────────────────────────────────

/** Round to ≤4 dp, drop trailing zeros, normalise -0. */
function fmt(n: number | undefined): string {
  if (n == null || !isFinite(n)) return '0';
  const r = Math.round(n * 1e4) / 1e4;
  return Object.is(r, -0) ? '0' : String(r);
}

/** GGB label `A_1` → LaTeX/tkz `A_{1}`; leave already-braced or plain names. */
function texName(name: string): string {
  return name.replace(/_([A-Za-z0-9]+)/g, '_{$1}');
}

interface ParsedCommand { fn: string; args: string[] }

export function splitTopLevelArgs(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(' || ch === '{' || ch === '[') depth++;
    else if (ch === ')' || ch === '}' || ch === ']') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export function parseCommand(cmd: string): ParsedCommand | null {
  let c = cmd.trim();
  // some bundles return "Label = Command(...)"; keep only the command.
  const assign = c.match(/^[A-Za-z_][\w']*\s*=\s*([\s\S]+)$/);
  if (assign && assign[1].includes('(')) c = assign[1].trim();
  const m = c.match(/^([A-Za-z]+)\s*\(([\s\S]*)\)\s*$/);
  if (!m) return null;
  return { fn: m[1], args: splitTopLevelArgs(m[2]) };
}

function isNumberLiteral(s: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(s.trim());
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Circumcentre + radius of three points (NaN-safe; collinear → r=0). */
function circumcircle(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): { x: number; y: number; r: number } {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-12) return { x: a.x, y: a.y, r: 0 };
  const ux = ((a.x ** 2 + a.y ** 2) * (b.y - c.y) + (b.x ** 2 + b.y ** 2) * (c.y - a.y) + (c.x ** 2 + c.y ** 2) * (a.y - b.y)) / d;
  const uy = ((a.x ** 2 + a.y ** 2) * (c.x - b.x) + (b.x ** 2 + b.y ** 2) * (a.x - c.x) + (c.x ** 2 + c.y ** 2) * (b.x - a.x)) / d;
  return { x: ux, y: uy, r: Math.hypot(a.x - ux, a.y - uy) };
}

// ── construction index ──────────────────────────────────────────────────────

interface ConicInfo {
  center?: string;        // centre point name
  through?: string;       // a point on the circle
  radiusNum?: number;     // explicit numeric radius
  pts3?: [string, string, string];
  cx?: number; cy?: number; r?: number;   // resolved numeric geometry
}

interface Index {
  pts: Map<string, { x: number; y: number }>;
  linePts: Map<string, [string, string]>;  // line/segment/ray → its 2 defining points
  conics: Map<string, ConicInfo>;
}

function buildIndex(objects: GgbObject[]): Index {
  const pts = new Map<string, { x: number; y: number }>();
  for (const o of objects) {
    if (o.type === 'point' && o.x != null && o.y != null) pts.set(o.name, { x: o.x, y: o.y });
  }

  const linePts = new Map<string, [string, string]>();
  const conics = new Map<string, ConicInfo>();
  for (const o of objects) {
    const parsed = parseCommand(o.command);
    if (!parsed) continue;
    const { fn, args } = parsed;
    if ((fn === 'Line' || fn === 'Segment' || fn === 'Ray') && args.length >= 2
      && pts.has(args[0]) && pts.has(args[1])) {
      linePts.set(o.name, [args[0], args[1]]);
    } else if (fn === 'Circle') {
      const info: ConicInfo = {};
      if (args.length === 2 && pts.has(args[0]) && pts.has(args[1])) {
        info.center = args[0]; info.through = args[1];
        const c = pts.get(args[0])!; const t = pts.get(args[1])!;
        info.cx = c.x; info.cy = c.y; info.r = dist(c, t);
      } else if (args.length === 2 && pts.has(args[0]) && isNumberLiteral(args[1])) {
        info.center = args[0]; info.radiusNum = parseFloat(args[1]);
        const c = pts.get(args[0])!; info.cx = c.x; info.cy = c.y; info.r = info.radiusNum;
      } else if (args.length === 3 && args.every((p) => pts.has(p))) {
        info.pts3 = [args[0], args[1], args[2]];
        const cc = circumcircle(pts.get(args[0])!, pts.get(args[1])!, pts.get(args[2])!);
        info.cx = cc.x; info.cy = cc.y; info.r = cc.r;
      }
      conics.set(o.name, info);
    }
  }
  return { pts, linePts, conics };
}

/** A line/segment/ray argument → its 2 defining points (named object OR inline). */
function resolveLineArg(arg: string, idx: Index): [string, string] | null {
  const named = idx.linePts.get(arg);
  if (named) return named;
  const p = parseCommand(arg);
  if (p && (p.fn === 'Line' || p.fn === 'Segment' || p.fn === 'Ray')
    && p.args.length >= 2 && idx.pts.has(p.args[0]) && idx.pts.has(p.args[1])) {
    return [p.args[0], p.args[1]];
  }
  return null;
}

/** A circle argument → its ConicInfo (named object OR inline Circle(...)). */
function resolveConicArg(arg: string, idx: Index): ConicInfo | null {
  const named = idx.conics.get(arg);
  if (named) return named;
  const p = parseCommand(arg);
  if (p && p.fn === 'Circle' && p.args.length === 2 && idx.pts.has(p.args[0]) && idx.pts.has(p.args[1])) {
    return { center: p.args[0], through: p.args[1] };
  }
  return null;
}

/**
 * Whether a point should be drawn + labelled. The customer labels meaningful
 * points (single uppercase, optional prime/subscript) and anything they caption;
 * scaffolding like `midBQ`, `M_AD`, `__o3` stays defined but unlabelled.
 */
function isMeaningfulPoint(o: GgbObject): boolean {
  if (o.labelVisible === false) return false;
  if (o.caption && o.caption.trim()) return true;
  return /^[A-Z]'*(?:_\d+|_\{[^}]+\}|\d)?$/.test(o.name);
}

// ── tkz-euclide renderer (house style) ───────────────────────────────────────

const TRIANGLE_CENTER: Record<string, { macro: string; zh: string }> = {
  '1': { macro: 'in', zh: '内心' },
  '2': { macro: 'centroid', zh: '重心' },
  '3': { macro: 'circum', zh: '外心' },
  '4': { macro: 'ortho', zh: '垂心' },
  '5': { macro: 'euler', zh: '九点圆心' },
};

function renderTkz(objects: GgbObject[], idx: Index): TikzExportResult {
  const pointDefs: string[] = [];
  const segs: string[] = [];
  const dashedSegs: string[] = [];
  const circleDraws: string[] = [];
  const polygonDraws: string[] = [];
  const drawPoints: string[] = [];
  const consumedInter = new Set<string>();   // intersection objects already emitted as a pair
  let fallbackCount = 0;

  /** tkz arg form for a line: its two defining points (named or inline), else null. */
  const linePair = (n: string): [string, string] | null => resolveLineArg(n, idx);

  // Pre-group intersection points that share the same operand pair (X,Y of two circles).
  const interByPair = new Map<string, GgbObject[]>();
  for (const o of objects) {
    if (o.type !== 'point') continue;
    const p = parseCommand(o.command);
    if (p && p.fn === 'Intersect' && p.args.length >= 2) {
      const key = [p.args[0], p.args[1]].sort().join('∩');
      (interByPair.get(key) ?? interByPair.set(key, []).get(key)!).push(o);
    }
  }

  const numericPoint = (o: GgbObject, zh: string, countAsFallback = true) => {
    pointDefs.push(`    \\tkzDefPoint(${fmt(o.x)},${fmt(o.y)}){${texName(o.name)}} %${zh}`);
    if (countAsFallback) fallbackCount++;
  };

  for (const o of objects) {
    if (o.type !== 'point') continue;
    const N = texName(o.name);
    const parsed = parseCommand(o.command);

    if (!parsed) { numericPoint(o, '自由点', false); }
    else {
      const { fn, args } = parsed;
      if (fn === 'Midpoint' && args.length === 2 && idx.pts.has(args[0]) && idx.pts.has(args[1])) {
        pointDefs.push(`    \\tkzDefMidPoint(${texName(args[0])},${texName(args[1])})\\tkzGetPoint{${N}} %中点`);
      } else if (fn === 'TriangleCenter' && args.length === 4 && TRIANGLE_CENTER[args[3]]) {
        const { macro, zh } = TRIANGLE_CENTER[args[3]];
        const tri = `${texName(args[0])},${texName(args[1])},${texName(args[2])}`;
        pointDefs.push(macro === 'in'
          ? `    \\tkzInCenter(${tri})\\tkzGetPoint{${N}} %内心`
          : `    \\tkzDefTriangleCenter[${macro}](${tri})\\tkzGetPoint{${N}} %${zh}`);
      } else if (fn === 'Reflect' && args.length === 2 && idx.pts.has(args[0])) {
        const lp = linePair(args[1]);
        if (lp) pointDefs.push(`    \\tkzDefPointBy[reflection = over ${texName(lp[0])}--${texName(lp[1])}](${texName(args[0])})\\tkzGetPoint{${N}} %轴反射`);
        else if (idx.pts.has(args[1])) pointDefs.push(`    \\tkzDefPointBy[symmetry=center ${texName(args[1])}](${texName(args[0])})\\tkzGetPoint{${N}} %中心对称`);
        else numericPoint(o, '反射');
      } else if (fn === 'ClosestPoint' && args.length === 2 && idx.pts.has(args[1]) && linePair(args[0])) {
        const lp = linePair(args[0])!;
        pointDefs.push(`    \\tkzDefPointBy[projection = onto ${texName(lp[0])}--${texName(lp[1])}](${texName(args[1])})\\tkzGetPoint{${N}} %投影`);
      } else if (fn === 'Point' && args.length === 2 && isNumberLiteral(args[1]) && linePair(args[0])) {
        const lp = linePair(args[0])!;
        pointDefs.push(`    \\tkzDefPointOnLine[pos=${fmt(parseFloat(args[1]))}](${texName(lp[0])},${texName(lp[1])})\\tkzGetPoint{${N}} %线上点`);
      } else if (fn === 'Intersect' && args.length >= 2) {
        emitIntersection(o, parsed);
      } else {
        numericPoint(o, '构造点');
      }
    }

    if (o.visible && isMeaningfulPoint(o)) drawPoints.push(N);
  }

  function emitIntersection(o: GgbObject, parsed: ParsedCommand) {
    if (consumedInter.has(o.name)) return;
    const [a, b] = parsed.args;
    const aPair = linePair(a); const bPair = linePair(b);
    const aConic = resolveConicArg(a, idx); const bConic = resolveConicArg(b, idx);

    const conicArgs = (c: ConicInfo): string | null =>
      c.center && c.through ? `${texName(c.center)},${texName(c.through)}`
        : c.pts3 ? `${texName(c.pts3[0])},${texName(c.pts3[1])}` : null;

    // line ∩ line → single point.
    if (aPair && bPair) {
      pointDefs.push(`    \\tkzInterLL(${texName(aPair[0])},${texName(aPair[1])})(${texName(bPair[0])},${texName(bPair[1])})\\tkzGetPoint{${texName(o.name)}} %交点`);
      consumedInter.add(o.name);
      return;
    }

    // line ∩ circle  or  circle ∩ circle → two points; pair them up.
    const key = [a, b].sort().join('∩');
    const group = (interByPair.get(key) ?? []).filter((g) => !consumedInter.has(g.name));
    let macro: string | null = null;
    let opnds: string | null = null;
    if (aPair && bConic) { macro = 'InterLC'; const ca = conicArgs(bConic); if (ca) opnds = `(${texName(aPair[0])},${texName(aPair[1])})(${ca})`; }
    else if (bPair && aConic) { macro = 'InterLC'; const ca = conicArgs(aConic); if (ca) opnds = `(${texName(bPair[0])},${texName(bPair[1])})(${ca})`; }
    else if (aConic && bConic) { macro = 'InterCC'; const ca = conicArgs(aConic); const cb = conicArgs(bConic); if (ca && cb) opnds = `(${ca})(${cb})`; }

    if (macro && opnds) {
      const first = texName(group[0].name);
      const second = group[1] ? texName(group[1].name) : `${first}'`;
      pointDefs.push(`    \\tkz${macro}${opnds}\\tkzGetPoints{${first}}{${second}} %交点`);
      consumedInter.add(group[0].name);
      if (group[1]) consumedInter.add(group[1].name);
      return;
    }

    numericPoint(o, '交点');
    consumedInter.add(o.name);
  }

  // Polygon edges are drawn by \tkzDrawPolygon — skip any segment that repeats one.
  const edgeKey = (a: string, b: string) => [a, b].sort().join('|');
  const polyEdges = new Set<string>();
  for (const o of objects) {
    if (o.type !== 'polygon') continue;
    const p = parseCommand(o.command);
    if (p && p.fn === 'Polygon') {
      for (let i = 0; i < p.args.length; i++) polyEdges.add(edgeKey(p.args[i], p.args[(i + 1) % p.args.length]));
    }
  }

  // segments / lines / circles / polygons
  for (const o of objects) {
    if (!o.visible) continue;
    if (o.type === 'segment' || o.type === 'line' || o.type === 'ray') {
      const lp = idx.linePts.get(o.name);
      // skip any segment/line/ray that merely repeats a polygon edge
      if (lp && !polyEdges.has(edgeKey(lp[0], lp[1]))) {
        (o.dashed ? dashedSegs : segs).push(`${texName(lp[0])},${texName(lp[1])}`);
      }
    } else if (o.type === 'conic') {
      const c = idx.conics.get(o.name);
      if (!c) continue;
      const dash = o.dashed ? '[dashed]' : '';
      if (c.center && c.through) {
        circleDraws.push(`    \\tkzDrawCircle${dash}(${texName(c.center)},${texName(c.through)})`);
      } else if (c.cx != null && c.cy != null && c.r != null) {
        // numeric centre+radius — define the centre then draw by radius.
        const cname = `O_{${circleDraws.length}}`;
        pointDefs.push(`    \\tkzDefPoint(${fmt(c.cx)},${fmt(c.cy)}){${cname}} %圆心`);
        const opt = o.dashed ? '[R,dashed]' : '[R]';
        circleDraws.push(`    \\tkzDrawCircle${opt}(${cname},${fmt(c.r)})`);
        fallbackCount++;
      }
    } else if (o.type === 'polygon') {
      const p = parseCommand(o.command);
      if (p && p.fn === 'Polygon' && p.args.every((a) => idx.pts.has(a))) {
        polygonDraws.push(`    \\tkzDrawPolygon(${p.args.map(texName).join(',')})`);
      }
    }
  }

  // labels grouped by position (centroid heuristic)
  const labelGroups = groupLabels(objects, idx);

  const body: string[] = [];
  body.push(...pointDefs);
  if (segs.length) body.push(`    \\tkzDrawSegments(${segs.join(' ')})`);
  if (dashedSegs.length) body.push(`    \\tkzDrawSegments[dashed](${dashedSegs.join(' ')})`);
  body.push(...circleDraws, ...polygonDraws);
  if (drawPoints.length) body.push(`    \\tkzDrawPoints(${drawPoints.join(',')})`);
  for (const [pos, names] of labelGroups) {
    if (names.length) body.push(`    \\tkzLabelPoints[${pos}](${names.join(',')})`);
  }

  const code = [
    '\\begin{center}',
    '\\begin{tikzpicture}[scale=0.6]',
    ...body,
    '\\end{tikzpicture}',
    '\\end{center}',
  ].join('\n');

  const total = objects.filter((o) => o.visible || o.type === 'point').length;
  return { code, note: `tkz-euclide · ${total} 个对象${fallbackCount ? ` · ${fallbackCount} 个回退为坐标` : ''}` };
}

/** Position label of each visible point by direction from the figure centroid. */
function groupLabels(objects: GgbObject[], idx: Index): Array<[string, string[]]> {
  const pts = [...idx.pts.values()];
  if (pts.length === 0) return [];
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const groups: Record<string, string[]> = { above: [], below: [], left: [], right: [] };
  for (const o of objects) {
    if (o.type !== 'point' || !o.visible || o.x == null || o.y == null || !isMeaningfulPoint(o)) continue;
    const dx = o.x - cx; const dy = o.y - cy;
    const pos = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'above' : 'below');
    groups[pos].push(texName(o.name));
  }
  return [['above', groups.above], ['below', groups.below], ['left', groups.left], ['right', groups.right]];
}

// ── raw PGF/TikZ renderer (GeoGebra-export look) ─────────────────────────────

function hexToRgb255(hex?: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? '').trim());
  if (!m) return [0, 0, 0];
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function widthPt(thickness?: number): string {
  const w = Math.max(0.4, Math.round((thickness ?? 2) * 0.4 * 10) / 10);
  return `${w}pt`;
}

function renderRaw(objects: GgbObject[], idx: Index): TikzExportResult {
  // collect colours → \definecolor palette
  const palette = new Map<string, string>();   // 'RRGGBB' → colour name
  const colorName = (hex?: string): string => {
    const [r, g, b] = hexToRgb255(hex);
    const key = [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
    if (key === '000000') return 'black';
    if (!palette.has(key)) palette.set(key, `c${palette.size}`);
    return palette.get(key)!;
  };

  const draws: string[] = [];
  const labels: string[] = [];

  // figure bbox (points + circle extents) for \clip
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  const grow = (x: number, y: number) => { minx = Math.min(minx, x); miny = Math.min(miny, y); maxx = Math.max(maxx, x); maxy = Math.max(maxy, y); };
  for (const p of idx.pts.values()) grow(p.x, p.y);

  for (const o of objects) {
    if (!o.visible) continue;
    const col = colorName(o.color);
    const style = `line width=${widthPt(o.thickness)}${col === 'black' ? '' : `,color=${col}`}${o.dashed ? ',dashed' : ''}`;
    if (o.type === 'segment' || o.type === 'line' || o.type === 'ray') {
      const lp = idx.linePts.get(o.name);
      if (!lp) continue;
      const p = idx.pts.get(lp[0])!; const q = idx.pts.get(lp[1])!;
      draws.push(`\\draw [${style}] (${fmt(p.x)},${fmt(p.y)})-- (${fmt(q.x)},${fmt(q.y)});`);
    } else if (o.type === 'conic') {
      const c = idx.conics.get(o.name);
      if (!c || c.cx == null || c.cy == null || c.r == null) continue;
      draws.push(`\\draw [${style}] (${fmt(c.cx)},${fmt(c.cy)}) circle (${fmt(c.r)}cm);`);
      grow(c.cx - c.r, c.cy - c.r); grow(c.cx + c.r, c.cy + c.r);
    } else if (o.type === 'polygon') {
      const p = parseCommand(o.command);
      if (p && p.fn === 'Polygon' && p.args.every((a) => idx.pts.has(a))) {
        const path = p.args.map((a) => { const pt = idx.pts.get(a)!; return `(${fmt(pt.x)},${fmt(pt.y)})`; }).join('-- ');
        draws.push(`\\draw [${style}] ${path}-- cycle;`);
      }
    }
  }

  // point dots + labels (scriptsize block, like GeoGebra)
  for (const o of objects) {
    if (o.type !== 'point' || !o.visible || o.x == null || o.y == null || !isMeaningfulPoint(o)) continue;
    const col = colorName(o.color);
    const fill = col === 'black' ? 'black' : col;
    labels.push(`\\draw [fill=${fill}] (${fmt(o.x)},${fmt(o.y)}) circle (1pt);`);
    labels.push(`\\draw[color=${col}] (${fmt(o.x + 0.18)},${fmt(o.y + 0.18)}) node {$${texName(o.name)}$};`);
  }

  const colorDefs = [...palette.entries()].map(([key, name]) => {
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(key.slice(i, i + 2), 16));
    return `\\definecolor{${name}}{RGB}{${r},${g},${b}}`;
  });

  const clip = isFinite(minx)
    ? [`\\clip(${fmt(minx - 0.5)},${fmt(miny - 0.5)}) rectangle (${fmt(maxx + 0.5)},${fmt(maxy + 0.5)});`]
    : [];

  const code = [
    ...colorDefs,
    '\\begin{tikzpicture}[line cap=round,line join=round,>=triangle 45,x=1cm,y=1cm]',
    ...clip,
    ...draws,
    '\\begin{scriptsize}',
    ...labels,
    '\\end{scriptsize}',
    '\\end{tikzpicture}',
  ].join('\n');

  const total = objects.filter((o) => o.visible).length;
  return { code, note: `raw PGF/TikZ · ${total} 个对象` };
}

// ── entry point ──────────────────────────────────────────────────────────────

export function ggbToTikz(objects: GgbObject[], mode: TikzMode): TikzExportResult {
  if (objects.length === 0) {
    return { code: mode === 'tkz' ? '% 画布为空' : '% empty canvas', note: '画布为空' };
  }
  const idx = buildIndex(objects);
  return mode === 'tkz' ? renderTkz(objects, idx) : renderRaw(objects, idx);
}
