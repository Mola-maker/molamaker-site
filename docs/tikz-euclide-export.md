# GeoGebra → TikZ "Magic!" export — distilled customer style + feature spec

> Distilled 2026-06-06 from 8 user-supplied competition `.tex` files
> (`2021年中国女子数学奥林匹克`, `ea联赛真题辑录`, `2021马其顿JMO`, `2021年泛非/加拿大/…`).
> Purpose: a **"Magic!" button** on the Math-Studio GeoGebra canvas that turns the
> *current drawing* into TikZ in the customer's own style.

---

## 1. What the customer actually writes (two distinct habits)

### Style A — `tkz-euclide`, construction-based (THE house style)

Dominant by far. Macro frequency across the corpus:

| count | macro | count | macro |
|------:|-------|------:|-------|
| 98 | `\tkzGetPoint` | 13 | `\tkzDefPoints` |
| 63 | `\tkzLabelPoints` | 12 | `\tkzDefPoint` |
| 28 | `\tkzInterLL` | 7 | `\tkzInterLC` / `\tkzInterCC` |
| 24 | `\tkzGetPoints` | 7 | `\tkzDrawPoints` |
| 24 | `\tkzDrawCircle` | 5 | `\tkzInCenter` / `\tkzDefPointOnLine` |
| 21 | `\tkzDefTriangleCenter` | 4 | `\tkzDefLine` / `\tkzGetLength` |
| 20 | `\tkzDrawSegments` | 3 | `\tkzDrawPolygon` / `\tkzDefMidPoint` / `\tkzDefCircle` / `\tkzDefPointWith` |
| 19 | `\tkzDefPointBy` | 2 | `\tkzLabelCircle` / `\tkzDefSpcTriangle` / `\tkzDrawPoint` |
| 16 | `\tkzDefTangent` | — | (`\tkzDefRandPointOn`, `\tkzDefPointOnCircle`, `\tkzDefPointsBy`) |

Representative figure (from `2021年中国女子数学奥林匹克.tex`):

```latex
\begin{center}
\begin{tikzpicture}[scale=0.6]
    \tkzDefPoints{0/0/B,5/0/C,1/5/A}
    \tkzDefTriangleCenter[circum](A,B,C) \tkzGetPoint{O} %外心
    \tkzInCenter(A,B,C)\tkzGetPoint{I}                   %内心
    \tkzDefTriangleCenter[ex](B,A,C)\tkzGetPoint{J}      %A 所对旁心
    \tkzDefCircle[diameter](A,I)\tkzGetPoint{A_{1}}
    \tkzDefLine[mediator](I,J) \tkzGetPoints{I_{1}}{J_{1}} %IJ 中垂线
    \tkzInterLL(I_{1},J_{1})(B,C) \tkzGetPoint{K}
    \tkzInterCC(O,A)(A_{1},A)\tkzGetPoints{X}{A}
    \tkzDrawSegments(A,B A,K A,C K,B A,X A,Y X,Y X,I Y,J)
    \tkzDrawSegments[dashed](A,J)
    \tkzDrawCircle(O,A)
    \tkzDrawPoints(O,I,J)
    \tkzLabelPoints[below](B,C,K,J)
    \tkzLabelPoints[above](A)
    \tkzLabelPoints[left](X)
    \tkzLabelPoints[right](Y,I,O)
\end{tikzpicture}
\end{center}
```

**Conventions (the "habit" to reproduce):**
- Wrapper: `\begin{center}` → `\begin{tikzpicture}[scale=0.6]` → `\end{tikzpicture}` → `\end{center}`.
  `scale=0.6` is the usual value (sometimes omitted).
- Preamble: `ctexbook` + `\usepackage{tikz}` + `\usepackage{tkz-euclide}` (modern tkz-euclide
  needs no `\usetkzobj`). The figure block is what gets pasted; the preamble is implicit.
- Body order, always: **(1)** base points → **(2)** derived points (each `\tkzDef…` immediately
  followed by `\tkzGetPoint{…}` / `\tkzGetPoints{…}{…}` and a trailing `% Chinese comment`) →
  **(3)** draws (`\tkzDrawSegments`, `\tkzDrawCircle`, `\tkzDrawPolygon`, `\tkzDrawPoints`) →
  **(4)** labels (`\tkzLabelPoints[pos](…)`).
- `\tkzDrawSegments(A,B C,D E,F)` groups many segments in ONE call (space-separated pairs).
- Dashed for auxiliary: `\tkzDrawSegments[dashed](…)`, `\tkzDrawCircle[dashed](…)`.
- Naming: single uppercase letters; subscripts in braces `A_{1}`, `I_{1}`; primes `K'`, `L'`.
- Comments in **Chinese**, after `%`, explaining each construction step.

### Style B — raw PGF/TikZ, absolute coordinates (GeoGebra's own export)

Appears only in `ea联赛真题辑录.tex` (the older "img" figures). Example:

```latex
\begin{tikzpicture}[line cap=round,line join=round,>=triangle 45,x=1cm,y=1cm]
\clip(-3.06,-8.65) rectangle (22.97,3.13);
\draw [line width=0.8pt] (2.57,-1.48) circle (3.64cm);
\draw [line width=0.8pt] (-0.34,-3.66)-- (3.94,-6.22);
\begin{scriptsize}
\draw [fill=ududff] (2.57,-1.48) circle (1pt);
\draw[color=ududff] (2.75,-1.11) node {$A$};
\end{scriptsize}
\end{tikzpicture}
```

The tell-tale `line cap=round,line join=round,>=triangle 45,x=1cm,y=1cm`, the `\clip`, the
`circle (1pt)` point dots inside `scriptsize`, and the auto color names **`ududff` / `uuuuuu` /
`xdxdff`** are GeoGebra's *built-in* "Export Graphics View as PGF/TikZ" output. It is generic,
verbose, non-semantic, and hard to edit.

**Conclusion:** the value-add the customer wants from "Magic!" is **Style A (tkz-euclide)** —
the clean construction form GeoGebra *cannot* produce itself. Style B is what they're trying to
avoid. So the target output is tkz-euclide.

---

## 2. Why this maps onto GeoGebra cleanly

Both GeoGebra and tkz-euclide are **construction-based** (objects defined by operations on prior
objects), so the translation is largely 1:1. The GeoGebra JS applet API exposes everything needed:

| API | use |
|-----|-----|
| `getAllObjectNames()` | enumerate construction in creation order |
| `getObjectType(name)` | `point` / `segment` / `line` / `conic` / `circle` / `polygon` / `numeric` |
| `getCommandString(name)` | the defining command, e.g. `Intersect(f,g)`, `Midpoint(B,C)`, `TriangleCenter(A,B,C,3)` (empty for free objects) |
| `getValueString(name)` / `getXcoord` / `getYcoord` | numeric coords for free points + the **numeric fallback** |
| `getColor` / `getLineThickness` / `getLineStyle` | dashed / styling |
| `getVisible(name)` / `isDefined(name)` | skip hidden/undefined objects |

(`GgbApiLike` in `lib/workplace/geogebra-eval.ts` currently types only `evalCommand`/`exists`;
these read methods must be added to the `GGBApi` type in `components/redesign/workplace-math.tsx`.)

---

## 3. GeoGebra command → tkz-euclide macro mapping

`P`, `Q`, … = result point name(s). Every defined point emits `\tkzDef…` + `\tkzGetPoint{P}`.

| GeoGebra command | tkz-euclide |
|------------------|-------------|
| free point `P=(x,y)` | `\tkzDefPoint(x,y){P}` |
| `Midpoint(A,B)` | `\tkzDefMidPoint(A,B)\tkzGetPoint{P}` |
| `Intersect(line1,line2)` | `\tkzInterLL(A,B)(C,D)\tkzGetPoint{P}` * |
| `Intersect(line,conic[,n])` | `\tkzInterLC(A,B)(O,r)\tkzGetPoints{P}{Q}` * |
| `Intersect(conic1,conic2[,n])` | `\tkzInterCC(O1,A)(O2,B)\tkzGetPoints{P}{Q}` * |
| `TriangleCenter(A,B,C,1)` (incenter X1) | `\tkzInCenter(A,B,C)\tkzGetPoint{I}` or `\tkzDefTriangleCenter[in]` |
| `TriangleCenter(A,B,C,2)` (centroid X2) | `\tkzDefTriangleCenter[centroid](A,B,C)\tkzGetPoint{G}` |
| `TriangleCenter(A,B,C,3)` (circumcenter X3) | `\tkzDefTriangleCenter[circum](A,B,C)\tkzGetPoint{O}` |
| `TriangleCenter(A,B,C,4)` (orthocenter X4) | `\tkzDefTriangleCenter[ortho](A,B,C)\tkzGetPoint{H}` |
| `TriangleCenter(A,B,C,5)` (nine-point X5) | `\tkzDefTriangleCenter[euler](A,B,C)\tkzGetPoint{N}` |
| excenter | `\tkzDefTriangleCenter[ex](B,A,C)\tkzGetPoint{J}` |
| `Reflect(P, Line(A,B))` | `\tkzDefPointBy[reflection = over A--B](P)\tkzGetPoint{Q}` |
| `Reflect(P, A)` (point symmetry) | `\tkzDefPointBy[symmetry=center A](P)\tkzGetPoint{Q}` |
| foot of perpendicular / `ClosestPoint(Line(A,B),P)` | `\tkzDefPointBy[projection = onto A--B](P)\tkzGetPoint{Q}` |
| `Translate(P, Vector(A,B))` | `\tkzDefPointBy[translation=from A to B](P)\tkzGetPoint{Q}` |
| `PerpendicularBisector(A,B)` | `\tkzDefLine[mediator](A,B)\tkzGetPoints{P}{Q}` |
| `PerpendicularLine(P,Line(A,B))` | `\tkzDefLine[orthogonal=through P](A,B)\tkzGetPoint{...}` |
| `Line(A,B)` (just a through-line) | drawn directly via `\tkzDrawLine(A,B)` |
| `Circle(O,A)` / `Circle(O,r)` | `\tkzDrawCircle(O,A)` (+ define via `\tkzDefCircle` if reused) |
| circle on diameter AB | `\tkzDefCircle[diameter](A,B)\tkzGetPoint{O}` |
| `Tangent(P,conic)` | `\tkzDefTangent[from=P](O,A)\tkzGetPoints{T1}{T2}` |
| tangent at point on conic | `\tkzDefTangent[at=A](O,B)\tkzGetPoint{...}` |
| `Segment(A,B)` (visible) | collect into `\tkzDrawSegments(A,B …)` |
| `Polygon(A,B,C,…)` | `\tkzDrawPolygon(A,B,C,…)` |
| point on line at param t | `\tkzDefPointOnLine[pos=t](A,B)\tkzGetPoint{P}` |
| point on circle at angle | `\tkzDefPointOnCircle[angle=θ,center=O,radius=r cm]\tkzGetPoint{P}` |

\* tkz intersection macros take the **defining points** of each line/circle, not the GeoGebra
object handle. The transpiler must resolve each line/conic argument back to the two points (or
center+through-point) that defined it. When that resolution fails → numeric fallback.

### Numeric fallback (guarantees compilable output)

For any object whose command we cannot map (unknown command, or an argument we can't resolve to
points), emit it by its **numeric value**, which the applet always provides — staying inside
tkz-euclide:
- point → `\tkzDefPoint(x,y){P}` (coords rounded to 3 dp)
- circle → `\tkzDrawCircle[R](O, r)` from numeric center+radius, or fall back to a raw
  `\draw (x,y) circle (r cm);`
- segment/line between two known points → `\tkzDrawSegments(A,B)`

This is the safety net: recognized constructions become semantic tkz-euclide; everything else is
still correct (just coordinate-based).

### Labels

Emit `\tkzLabelPoints[pos](…)`, grouping points by chosen position. Position heuristic from the
label offset GeoGebra stores, else by the point's location relative to the figure centroid:
above / below / left / right (their files also use `below left`, `above right`, `left=+2pt`).

---

> **Implementation note (v2):** the self-hosted GWT web3d bundle returns **empty from
> `getCommandString`**, so reading the applet loses all construction semantics (every point looks
> free, segments have no endpoints). The exporter therefore transpiles from the **GGB command script
> the app already holds** (`lastSuccessfulRef.current` — the exact `evalCommand` lines) via
> `lib/workplace/tikz-export/ggb-script.ts`, and uses the applet **only** for evaluated coordinates
> (`getXcoord`/`getYcoord`, which do work). The pure applet read (`readGgbConstruction`) remains the
> fallback for purely hand-drawn figures with no script.

## 4. Feature plan ("Magic!" button)

1. **Read** the construction — preferably from the command script (§ note above), else the applet.
2. **Transpile** to tkz-euclide (§3 mapping + numeric fallback) — a new pure module
   `lib/workplace/tikz-export/ggb-to-tikz.ts` (unit-testable: object list → tkz string).
3. **Wrap** in `\begin{center}\begin{tikzpicture}[scale=0.6] … \end{tikzpicture}\end{center}`,
   body ordered points → draws → labels, with Chinese step comments.
4. **UI**: a `Magic!` button in the Studio toolbar (next to "Reset canvas") → opens a side panel
   (reuse the existing KaTeX-panel pattern) showing the generated TikZ with a **复制 (copy)** button.

**Engine choice:** deterministic transpiler (pure function over the object list) — matches the
repo's "deterministic + real-engine, not LLM-audit" philosophy ([[project-geometry-renderer]]),
is unit-testable, and produces strict, always-compilable syntax. An optional LLM "polish" pass
could later prettify comments/label placement, but is not required for v1.

---

## 5. Open preference (confirm before building)

Target output style is **Style A (tkz-euclide)** per the evidence above. Confirm whether the
customer also wants a **Style B (GeoGebra raw-export) toggle** for parity with their older `ea联赛`
figures, or tkz-euclide only.
