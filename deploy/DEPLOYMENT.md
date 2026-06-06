# Deployment — Tencent COS+CDN (static) × Aliyun ECS (dynamic)

This site is **not** a pure static site. It ships SSR pages, `/api/*` route
handlers, i18n/auth, the AstrBot/NetEase proxies and Supabase server calls. So
`next export` (纯静态导出) is **not** viable — the app must run as a **Node
server** (`next start`). The split below keeps the heavy, cacheable bytes on
**Tencent COS + CDN** and runs the dynamic Node app on **Aliyun ECS**.

```
                 ┌──────────────────────── Tencent CDN (cdn.molamaker.cn) ──┐
  browser ──────▶│  /_next/static/*        (build assets, hashed, immutable)│
                 │  /public/geogebra/*     (GeoGebra Math Apps Bundle)      │
                 │  /public/live2d/*       (widget + models)                │
                 │  /public/redesign/*  /public/photo/*  (gifs, mp4)        │
                 └──────────────────────────────▲────────────── origin: COS ─┘
                                                 │ pull
  browser ──────▶  https://molamaker.cn  ──▶ nginx :443 ──▶ next start :3000 (Aliyun ECS)
                                                 │
                                                 ├─▶ 127.0.0.1:6185  AstrBot
                                                 ├─▶ 127.0.0.1:3100  NetEase API
                                                 └─▶ Supabase (managed, over TLS)
```

This deployment mirrors the whole `public/` folder under **`/public`** on the
CDN, and uploads `.next/static` to **`/_next/static`**. That's why the env vars
below include `/public`.

---

## 1. What goes where

| Asset / route | Type | Host |
|---|---|---|
| `app/**` SSR pages, `/api/**` | **dynamic** | **ECS** (Node) — server runtime, secrets, sessions |
| AstrBot `/api/astrbot/*`, proxy | dynamic | ECS — reaches `127.0.0.1:6185` |
| NetEase `/api/music/*` | dynamic | ECS — reaches `127.0.0.1:3100` |
| Supabase (auth/data) | dynamic | managed |
| `/_next/static/*` (JS/CSS/fonts) | **static** | **COS+CDN** at `/_next/static` |
| `public/geogebra/*` (Math bundle, 452 files) | static | COS+CDN at `/public/geogebra` |
| `public/live2d/*` | static | COS+CDN at `/public/live2d` |
| `public/redesign/*`, `public/photo/*` (gifs, mp4) | static | COS+CDN at `/public/...` |

Rule of thumb: **anything under `public/` that is large or hot → COS+CDN;
everything that runs code or reads secrets → ECS.**

---

## 2. Environment variables — the dev/prod split (do this first)

`NEXT_PUBLIC_*` vars are **inlined at build time**. The trick that keeps local
dev fast (same-origin, no CDN dependency) while the production build uses the
CDN is **which env file** they live in:

- Next loads **`.env.production.local`** for `next build` / `next start` — **not**
  for `next dev`.
- Next loads **`.env.local`** for *all* commands (dev included).

So put the CDN vars in **`.env.production.local`** (build/prod only), and keep
them **out of `.env.local`**:

```bash
# .env.production.local   (build machine — gitignored — inlined into the bundle)
NEXT_PUBLIC_CDN_BASE=https://cdn.molamaker.cn                              # ONLY the default --base for scripts/verify-cdn.mjs (NOT assetPrefix)
NEXT_PUBLIC_GEOGEBRA_BASE_URL=https://cdn.molamaker.cn/public/geogebra     # workplace-math.tsx
NEXT_PUBLIC_LIVE2D_BASE=https://cdn.molamaker.cn/public/live2d             # live2d-chat.tsx
NEXT_PUBLIC_PUBLIC_ASSET_BASE=https://cdn.molamaker.cn/public              # lib/asset-url.ts (redesign/photo/journey media)
```

With these unset in dev, `npm run dev` loads GeoGebra, Live2D, and media from
local `public/` (same-origin) — fast, and immune to CDN issues.

> **`assetPrefix` is deliberately NOT set** (see the comment block in
> `next.config.mjs`). Next 16 / Turbopack applies it inconsistently across chunks,
> which produced duplicate chunk loads. Therefore **`/_next/static/*` URLs are
> authored same-origin** (e.g. `https://molamaker.cn/_next/static/...`). To serve
> those bytes from the CDN, **nginx rewrites/proxies `/_next/static/` to the COS
> origin** — the app never emits a `cdn.molamaker.cn` chunk URL itself.
> `NEXT_PUBLIC_CDN_BASE` is consumed **only** by `scripts/verify-cdn.mjs`; nothing
> in the build reads it. The CDN origins ARE auto-added to the CSP, but from
> `NEXT_PUBLIC_GEOGEBRA_BASE_URL` and `NEXT_PUBLIC_PUBLIC_ASSET_BASE`
> (`script-/style-/font-/connect-/worker-/frame-/media-src`).

**ECS runtime secrets** (NOT inlined — read by `next start` from `.env` on the box):

```bash
SUPABASE_URL=…  SUPABASE_ANON_KEY=…  SUPABASE_SERVICE_ROLE_KEY=…
ANTHROPIC_API_KEY=…  DEEPSEEK_API_KEY=…  DASHSCOPE_API_KEY=…
GITHUB_TOKEN=…  GITHUB_USERNAME=Mola-maker
NETEASE_API_URL=http://127.0.0.1:3100
# Aliyun SMS keys, etc.
```

You do **not** need the `NEXT_PUBLIC_*` vars on ECS — they're already baked into
the bundle by the local build.

---

## 3. CDN layout, CORS, cache

Upload, preserving structure:

```
.next/static/     ->  cos://<bucket>/_next/static/   (every build — hashed names change)
public/geogebra/  ->  cos://<bucket>/public/geogebra/   (deployggb.js + HTML5/5.0/web3d/…)
public/live2d/    ->  cos://<bucket>/public/live2d/
public/redesign/  ->  cos://<bucket>/public/redesign/
public/photo/     ->  cos://<bucket>/public/photo/
```

CDN / COS rules:
- **CORS**: `Access-Control-Allow-Origin: https://molamaker.cn` (+ `www` if used),
  `GET`. Needed on **both** `/public/*` (GeoGebra/Live2D/fonts load cross-origin)
  **and** `/_next/static/*` (Next fonts under `media/` are fetched with CORS).
- **Cache**: `Cache-Control: public, max-age=31536000, immutable` on hashed paths
  (`/_next/static/*`, `/public/geogebra/*`).
- This GeoGebra bundle is the **pure-JS (GWT) build — no `.wasm`** — so there's no
  wasm content-type concern. (If you ever swap in a wasm build, serve `.wasm` as
  `application/wasm`.)
- GeoGebra's offline service worker only registers same-origin; from the CDN it's
  silently skipped — harmless.

Two media files intentionally stay on **ECS** (not CDN): the decorative
low-opacity background gifs in `app/redesign-styles/03-opening.css` — they live
on `::before`/`::after` pseudo-elements that JS can't rewrite. Everything else
under `redesign/photo/journey` is served from the CDN via `assetUrl()`
(`lib/asset-url.ts`).

**Verify every resource one-by-one** before shipping the server:

```bash
node scripts/verify-cdn.mjs --base https://cdn.molamaker.cn            # full (public + _next/static)
node scripts/verify-cdn.mjs --base https://cdn.molamaker.cn --public-only   # stable tree only
```

It HEAD-checks every local file against the CDN, reports `ok/missing/other` per
tree, checks CORS, and lists failing URLs. (`_next/static` is build-specific —
check it only after uploading the same build.)

---

## 4. ECS — one-time setup

```bash
# Node 22 + pm2
nvm install 22 && npm i -g pm2
mkdir -p /var/www/molamaker && cd /var/www/molamaker
# (server bundle is rsync'd in by the release flow — §5)
pm2 start "npm run start" --name molamaker -- -p 3000
pm2 save && pm2 startup
```

nginx (TLS terminator + reverse proxy — note the streaming-critical lines):

```nginx
server {
  listen 443 ssl http2;
  server_name molamaker.cn;
  ssl_certificate     /etc/letsencrypt/live/molamaker.cn/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/molamaker.cn/privkey.pem;

  gzip on; gzip_types text/plain application/json application/javascript text/css image/svg+xml;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For  $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;          # SSE / message bus / chat stream
    proxy_set_header Connection "";
    proxy_buffering off;                              # keep SSE responsive
    proxy_read_timeout 300s;                          # ← Math build/repair stream up to 150s
    proxy_send_timeout 300s;                          #   (nginx default 60s would cut them mid-figure)
  }
}
```

> **Streaming timeout (important):** the Math Studio `build`/`repair` routes
> stream SSE for up to **150s** (`TIMEOUT_MS`). nginx's default
> `proxy_read_timeout` is **60s**, which silently severs a slow thinking-model
> stream and leaves the GeoGebra figure half-drawn. The `300s` values (plus
> `proxy_buffering off`) are required.

- AstrBot (`6185`) / NetEase (`3100`) run on the **same box**, bound to
  `127.0.0.1` — never exposed publicly. The app reaches them server-side.
- Persisted state: `data/workplace-settings.json` (provider keys), rate-limit
  store. Put `data/` on a persistent, backed-up volume.

---

## 5. Build locally → deploy to ECS (each release)

The build runs on your **local Windows** machine; only the compiled `.next` +
runtime files ship to ECS.

```bash
# ── 1. local build (reads .env.production.local → CDN URLs inlined) ──
npm ci
npm run build

# ── 2. push static to COS+CDN ──
coscmd upload -r .next/static /_next/static          # every build (hashed names)
coscmd upload -r public/live2d /public/live2d        # after the Live2D chunk patch / model changes
coscmd upload -r public/geogebra /public/geogebra    # only when the bundle changes
# (public/redesign, public/photo only when they change)
node scripts/verify-cdn.mjs --base https://cdn.molamaker.cn   # confirm before shipping the server

# ── 3. ship the server to ECS + reload ──
#   next start needs: .next, public/, content/ (blog md read at runtime), config, prod node_modules
rsync -az --delete \
  .next public content package.json package-lock.json next.config.mjs \
  ecs:/var/www/molamaker/
ssh ecs 'cd /var/www/molamaker && npm ci --omit=dev && pm2 reload molamaker'
```

- `npm ci --omit=dev` on the ECS box rebuilds **native** deps (e.g. sharp) for
  Linux, since `.next` was compiled on Windows. If you ever hit a native-module
  error, build on the ECS box instead (`git pull && npm ci && npm run build`).
- CDN cache: `/_next/static` needs no purge (hashed). Purge `/public/geogebra/*`
  or `/public/live2d/*` only when you re-upload them.

---

## 6. China specifics (重要)

- **ICP 备案**: both `molamaker.cn` and `cdn.molamaker.cn` must be 备案'd, or
  mainland CDN/COS nodes return blocked/403.
- Prefer a mainland CDN region so users aren't routed overseas.
- We self-host GeoGebra because `cdn.geogebra.org` is slow/blocked in CN. The
  loader is CDN-first with a **same-origin `/geogebra` fallback** (`public/geogebra`
  on ECS), so a partial CDN upload can't take the panel down.
- `api.github.com` is consistently blocked/slow in CN. All GitHub fetches time
  out at **4.5s** and fall back to empty — the repo/commit widgets simply show
  nothing (no hang, no crash). To populate them, front GitHub with a CN-reachable
  proxy and point the fetches at it.

---

## 7. Checklist

- [ ] CDN vars live in **`.env.production.local`** (build/prod), NOT `.env.local` (dev stays local)
- [ ] ECS `.env` has the runtime secrets (Supabase / provider keys / SMS / `NETEASE_API_URL`)
- [ ] `.next/static` → `/_next/static`; `public/` → `/public/...` (every build for static)
- [ ] `node scripts/verify-cdn.mjs --base https://cdn.molamaker.cn` is clean
- [ ] COS CORS allows `https://molamaker.cn` on `/public/*` **and** `/_next/static/*`
- [ ] `/_next/static` + `/public/geogebra` cached `immutable`
- [ ] nginx: TLS, `proxy_buffering off`, `proxy_read_timeout 300s`
- [ ] AstrBot/NetEase bound to `127.0.0.1` only; `data/` on a persistent volume
- [ ] ICP 备案 done for `molamaker.cn` + `cdn.molamaker.cn`
- [ ] prod smoke test: chunks load from CDN (200), no CSP errors, Live2D moves, GeoGebra draws, Math SSE completes
```
