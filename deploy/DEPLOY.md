# molamaker.cn — full deployment runbook (canonical)

**This is the one file to deploy a release.** It is self-contained: a fresh session
can deploy from this alone. For the *first-time infrastructure* bring-up (DNS, TLS,
nginx) see the deeper rationale in [`RECOVERY.md`](./RECOVERY.md); this file folds the
repeatable parts in so you rarely need it.

- **Helpers used here:** [`deploy/push-ecs.sh`](./push-ecs.sh) (ship server bundle),
  [`scripts/verify-cdn.mjs`](../scripts/verify-cdn.mjs) (CDN reachability check).
- **Last verified build:** `BUILD_ID` is per-build (snapshot example: `M_J7I0FI900a0aHbBlrhH`).
  Always read the *current* one with `type .next\BUILD_ID` after building.

---

## 0. Architecture (what runs where)

```
                 Tencent COS (bucket) ──origin──▶ Tencent CDN (cdn.molamaker.cn)
                   /public/*    (geogebra 115M, photo 36M, live2d, redesign, journey)
                   (/_next/static is NOT on CDN — see note below)
                        ▲
 browser ─▶ Aliyun DNS ─▶ Aliyun ECS (123.56.64.88)
                            └─▶ nginx :443 (TLS) ─▶ next start :3000  (pm2: "molamaker")
                                        ├─▶ 127.0.0.1:6185  AstrBot
                                        ├─▶ 127.0.0.1:3100  NetEase music
                                        └─▶ Supabase (managed, TLS)
```

**Chunk-serving = Option A:** nginx proxies `/_next/static/` straight to the Node app
(`:3000`). Chunks are **not** on the CDN, so there is **zero build-skew risk** — the
exact build you ship is the one served. `assetPrefix` is intentionally unset in
`next.config.mjs` (Next 16 / Turbopack applied it inconsistently → duplicate chunks →
frozen page). The CDN only serves `public/*` (heavy media), via `assetUrl()` /
`NEXT_PUBLIC_*_BASE`.

| Host | A / CNAME | Value |
|------|-----------|-------|
| `molamaker.cn` (apex) | A | `123.56.64.88` |
| `www.molamaker.cn` | A | `123.56.64.88` (308 → apex) |
| `cdn.molamaker.cn` | CNAME | Tencent CDN host (e.g. `xxxx.cdn.dnsv1.com`) |

---

## 1. Two kinds of env — do not mix them

| File | Read when | Holds | Lives |
|------|-----------|-------|-------|
| `.env.production.local` | `next build` (this machine) | **PUBLIC** `NEXT_PUBLIC_*` CDN URLs, inlined into `.next` at build time | repo root (gitignored) |
| `.env` | `next start` (on ECS) | **SECRETS**: session secret, Supabase keys, owner phone, admin key | `/var/www/molamaker-site/.env` on the box |

Rule of thumb: **`NEXT_PUBLIC_*` → build-time (Windows). Everything secret → runtime (ECS `.env`).**
Changing a `NEXT_PUBLIC_*` value means you must **rebuild** (Step 3). `push-ecs.sh` never
ships `.env` and never deletes it, so box secrets persist across deploys.

Current `.env.production.local` (non-secret, CDN URLs):
```ini
NEXT_PUBLIC_CDN_BASE=https://cdn.molamaker.cn
NEXT_PUBLIC_GEOGEBRA_BASE_URL=https://cdn.molamaker.cn/public/geogebra
NEXT_PUBLIC_LIVE2D_BASE=https://cdn.molamaker.cn/public/live2d
NEXT_PUBLIC_PUBLIC_ASSET_BASE=https://cdn.molamaker.cn/public
```

---

## 2. Pre-flight verification (this machine — must be green before deploy)

```powershell
cd E:\Portaitsweb\molamaker-site
npx vitest run                 # expect: all tests pass (48+/48+)
npx tsc --noEmit               # expect: no output
npm run lint                   # expect: clean (eslint --max-warnings 0)
```
Do not deploy a red tree. If a test or typecheck fails, fix it first.

---

## 3. Build the release (this machine)

```powershell
cd E:\Portaitsweb\molamaker-site
npm ci                         # only if deps changed since last build
npm run build                  # reads .env.production.local → CDN URLs inlined
type .next\BUILD_ID            # ← record this; you verify it on the box in Step 7
```
A clean build prints the route table and `ƒ Proxy (Middleware)` (confirms the
`proxy.ts` middleware is picked up by Next 16). `.next/static` should be ~3–4 MB.

---

## 4. Runtime secrets on ECS (one-time per box; skip if already set)

`.env` persists across deploys, so you normally do this **once**. Confirm the real app
dir first (the box is `/var/www/molamaker-site`; `push-ecs.sh` *defaults* to
`/var/www/molamaker`, so you must override `APP_DIR` everywhere — see Step 6):

```bash
ssh root@123.56.64.88
pm2 describe molamaker | grep -i cwd        # ← the true APP_DIR
cd /var/www/molamaker-site                  # use whatever cwd printed above

cat > .env <<EOF
# Supabase (sessions, rate-limit RPC, workplace data)
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
# Session signing — MUST set, else cookies sign with the insecure dev default
WORKPLACE_SESSION_SECRET=$(openssl rand -hex 32)
# First-login owner + admin-key tab (blank ADMIN_KEY disables the Admin tab)
WORKPLACE_OWNER_PHONE=+86...
WORKPLACE_ADMIN_KEY=$(openssl rand -hex 32)
# Music (NetEase) — point at the local NeteaseCloudMusicApi Docker (Step 4a).
# Without it, search / play / now-playing / lyrics all fail. NETEASE_REAL_IP is
# OPTIONAL on this China-hosted box (only needed if the API runs outside China).
NETEASE_API_URL=http://127.0.0.1:3100
EOF

pm2 restart molamaker --update-env && pm2 save
```

Notes:
- `cat > .env <<EOF … EOF` avoids the `WORKPLACE_SESSION_SECRET=…: command not found`
  error you hit before — that happens when the assignment is pasted as a shell command.
- **Visitor mode** works with none of these (rate-limiter now **fails open**), but set
  the secret so sessions sign stably and survive restarts.
- The rate limiter needs the `check_rate` migration applied in Supabase to actually
  throttle (otherwise it just no-ops/fails-open — functional, no throttling). From this
  machine with the Supabase CLI linked: `npm run db:push`.

### 4a. Music: start the NetEase API container (one-time)

The music player **and** the stream "now playing" panel proxy through a local
NeteaseCloudMusicApi Docker. If it isn't running, search / play / now-playing / lyrics
all fall back to public `music.163.com` endpoints that NetEase blocks → all fail. Start it
on the box (it restarts on reboot):

```bash
cd /var/www/molamaker-site
docker compose -f deploy/netease/docker-compose.yml up -d
curl -s 'http://127.0.0.1:3100/search?keywords=test&limit=1' | head -c 200   # expect JSON with result.songs
```

It binds to `127.0.0.1:3100` only (never exposed publicly). If `docker` is missing:
`curl -fsSL https://get.docker.com | sh`. Once it's up and `NETEASE_API_URL` is in `.env`
(above), restart the app (`pm2 restart molamaker --update-env`). **No `NETEASE_REAL_IP`
needed on this box** — the container's own China IP passes NetEase's geo-check; set it only
if you ever move the API outside China.

---

## 5. CDN — upload only the `public/` subtrees that changed

`/_next/static` is **not** on the CDN (Option A), so a normal code release uploads
**nothing**. Upload only when a `public/` asset tree changed:

```bash
# coscmd configured once: coscmd config -a <SecretId> -s <SecretKey> -b <bucket-appid> -r <region>
coscmd upload -r public/live2d    /public/live2d     # NEW this release — Live2D loads from CDN
# rarely needed (already uploaded, change only if assets change):
# coscmd upload -r public/geogebra /public/geogebra   # 115 MB
# coscmd upload -r public/photo    /public/photo      # 36 MB
# coscmd upload -r public/redesign /public/redesign
# coscmd upload -r public/journey  /public/journey
```

> **Why Live2D matters:** the prod build sets `NEXT_PUBLIC_LIVE2D_BASE` to the CDN, so
> the widget fetches `https://cdn.molamaker.cn/public/live2d/autoload.js`. If the new
> files aren't on COS the widget 404s (non-fatal — the rest of the site is fine — but
> the feature won't appear).
> **Alternative:** unset `NEXT_PUBLIC_LIVE2D_BASE` in `.env.production.local` and
> rebuild → Live2D serves same-origin from the box (`push-ecs.sh` ships `public/`),
> no COS upload needed.

COS/CDN one-time settings (Tencent console): CORS `Access-Control-Allow-Origin:
https://molamaker.cn`, methods `GET, HEAD`, headers `*` (geogebra/live2d/fonts load
cross-origin); cache 1y for `/_next/static/*` (N/A in Option A) and
`/public/geogebra/*` (content-hashed/immutable). This GeoGebra bundle is pure-JS
(GWT), no `.wasm`.

---

## 6. Ship the server bundle + reload (this machine, Git Bash)

```bash
# Optional safety net — snapshot the live build for instant rollback BEFORE pushing
ssh root@123.56.64.88 'cd /var/www/molamaker-site && tar czf ~/molamaker-prev.tgz .next 2>/dev/null'

# The release:
ECS=root@123.56.64.88 APP_DIR=/var/www/molamaker-site bash deploy/push-ecs.sh
```

`push-ecs.sh` tars `.next public content package.json package-lock.json next.config.mjs
i18n`, streams over SSH, **removes the old `.next` first** (stale chunks die → kills the
frozen-opening bug), then `npm ci --omit=dev` (rebuilds native deps for Linux since you
built on Windows) and `pm2 reload molamaker && pm2 save`.

> ⚠ **Always pass `APP_DIR=/var/www/molamaker-site`.** The script's default is
> `/var/www/molamaker` (no `-site`); omitting it deploys to the wrong directory.

---

## 7. Verify the deploy (from your LAPTOP — real DNS, not the box)

```bash
curl -I http://molamaker.cn            # 308 → https://molamaker.cn
curl -I https://www.molamaker.cn       # 308 → https://molamaker.cn
curl -I https://molamaker.cn           # 200, valid cert, no warning
node scripts/verify-cdn.mjs --base https://cdn.molamaker.cn --public-only   # public/ (incl. live2d) all 200, CORS ACAO present
# build-id match: the chunk path the page serves must equal the box's BUILD_ID
curl -s https://molamaker.cn/en | grep -o '/_next/static/[A-Za-z0-9_-]\{8,\}/' | head -1
ssh root@123.56.64.88 'cat /var/www/molamaker-site/.next/BUILD_ID'
```

Browser checklist (Edge + Chrome):
- [ ] Padlock shows; no COOP "untrustworthy origin" console error.
- [ ] apex / www / http / https all land on the app.
- [ ] **Opening scene → click/Enter enters the site** (no frozen overlay; no
      `/_next/static/...` 404s in the Network tab).
- [ ] No `/_vercel/*/script.js` 404 noise (gated off the ECS build).
- [ ] **Workplace → "Enter as visitor"** lets you in; **admin password** + **phone OTP**
      work. After login `GET /api/workplace/auth/me` → 200 (not 401).
- [ ] DevTools → Application → Cookies → `wp-session` present, `Secure ✓`, `HttpOnly ✓`,
      `SameSite=Lax`, Domain `molamaker.cn`.
- [ ] **Math Studio** draws a geometry problem correctly (the GGB fixes are server-side
      in `.next`; the GeoGebra bundle itself is unchanged on the CDN).

```bash
ssh root@123.56.64.88 'pm2 logs molamaker --lines 60 --nostream'   # check for runtime errors
```

---

## 8. Rollback (if Step 7 fails)

```bash
# Fast path — restore the pre-deploy snapshot from Step 6:
ssh root@123.56.64.88 'cd /var/www/molamaker-site && rm -rf .next && tar xzf ~/molamaker-prev.tgz && pm2 reload molamaker'

# Or rebuild a known-good commit locally and re-push:
git checkout <last-good-commit> -- .        # or full checkout
npm ci && npm run build
ECS=root@123.56.64.88 APP_DIR=/var/www/molamaker-site bash deploy/push-ecs.sh
```

---

## 9. What changed in this release (context for verifiers)

- **GGB drawing fixes (server-side, in `.next`):** `lib/workplace/geogebra-eval.ts`
  (detect exec failures via `api.exists()` — the bundle lacks the error-string API),
  `lib/workplace/geometry-render/reorder.ts` + `app/api/workplace/math/route.ts`
  (define-before-use topological reorder), `lib/workplace/math-system-prompt.ts`
  (constraints constructed not approximated). No CDN change needed.
- **Deploy fixes:** `lib/rate-limit.ts` fails open (no more 429-locked logins);
  `components/redesign/v-workplace.tsx` `credentials:'include'` on auth fetches;
  `next.config.mjs` HSTS gated to prod + `preload` dropped; Vercel Analytics/SpeedInsights
  gated to `process.env.VERCEL` only.
- **Live2D (new):** needs `public/live2d/` on COS (Step 5) or same-origin rebuild.
- `middleware.ts` → `proxy.ts` (Next 16 convention).

---

## 10. Recurring release — the short version

```
1. npx vitest run && npx tsc --noEmit && npm run lint     (green)
2. npm run build                                           (note BUILD_ID)
3. coscmd upload -r public/<changed-tree> /public/<...>    (only if assets changed)
4. node scripts/verify-cdn.mjs --base https://cdn.molamaker.cn --public-only
5. ECS=root@123.56.64.88 APP_DIR=/var/www/molamaker-site bash deploy/push-ecs.sh
6. curl smoke test + BUILD_ID match + browser checklist
```
