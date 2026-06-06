# molamaker.cn — full recovery guide (Aliyun ECS + Tencent COS+CDN)

Copy-paste runbook to fix all 5 production failures. Architecture:

```
                  Tencent COS (bucket)  ──origin──▶  Tencent CDN (cdn.molamaker.cn)
                    /public/*   (156 MB: geogebra 115M, photo 36M, live2d, redesign)
                    /_next/static/*  (3.4 MB, hashed per build — re-upload every build)
                         ▲
  browser ─▶ Aliyun DNS ─▶ Aliyun ECS  ─▶ nginx :443 (TLS) ─▶ next start :3000
                                              ├─▶ 127.0.0.1:6185  AstrBot
                                              ├─▶ 127.0.0.1:3100  NetEase music
                                              └─▶ Supabase (managed, TLS)
```

Two ways to serve `/_next/static`:
- **Option A (recommended first): no CDN for chunks.** nginx serves `/_next/static`
  straight from the Node app. Zero build-skew risk → kills the frozen-opening bug
  outright. You still serve the heavy `public/` (geogebra/photo) from CDN.
- **Option B: CDN for chunks too.** Lower ECS egress, but you MUST upload the exact
  build's chunks and verify before reload, or every chunk 404s and the page freezes.

Start with **A**, move to **B** later once the release flow is automated.

---

# PHASE 0 — SSH in, snapshot current state (2 min)

```bash
ssh root@<ECS-IP>
APP=/var/www/molamaker
cd $APP

# What's actually running / listening?
pm2 list
sudo ss -ltnp | grep -E ':80|:443|:3000|:6185|:3100'   # who owns each port
nginx -v && nginx -t                                    # nginx present? config valid?
ls -la /etc/letsencrypt/live/ 2>/dev/null || echo "NO certs yet"

# What build is on disk right now?
cat $APP/.next/BUILD_ID 2>/dev/null || echo "no .next on box"
```

Note whether nginx is even installed and whether port 443 is listening. If the
app is currently exposed by running `next start` on a public port (e.g. :3000
open to the world, or nginx proxying :80 only), that's the whole TLS problem.

---

# PHASE 1 — DNS (Aliyun) — point the names at the box (5 min + propagation)

In **Aliyun console → 云解析 DNS → molamaker.cn → 解析设置**:

| Record | Type | Host | Value |
|--------|------|------|-------|
| apex   | A    | `@`   | `<your real ECS public IP>` |
| www    | A    | `www` | `<your real ECS public IP>` (or CNAME → `molamaker.cn`) |
| cdn    | CNAME| `cdn` | `<the CNAME Tencent CDN gave you>` (e.g. `xxxx.cdn.dnsv1.com`) |

Verify from your laptop (NOT the ECS box — it may resolve internally):

```bash
dig +short molamaker.cn A
dig +short www.molamaker.cn A
dig +short cdn.molamaker.cn       # should chain to a Tencent CDN host
```

> A diagnostic run saw the apex resolve to `198.18.2.32` — a reserved benchmarking
> IP. If you see anything that isn't your ECS public IP, fix the A record first;
> nothing else will work until this is right.

**备案 (ICP):** both `molamaker.cn` AND `cdn.molamaker.cn` must be filed, or
mainland Tencent CDN/COS nodes return 403/blocked. Aliyun ECS also requires the
domain 备案'd to serve 80/443 on a mainland IP.

---

# PHASE 2 — TLS cert on ECS (fixes #4) (5 min)

```bash
# Install certbot + nginx plugin
# Ubuntu/Debian:
sudo apt update && sudo apt install -y certbot python3-certbot-nginx nginx
# CentOS/AliyunLinux:
# sudo yum install -y certbot python3-certbot-nginx nginx

# Open the security group FIRST: in Aliyun console → ECS → 安全组 → 入方向,
# allow TCP 80 and 443 from 0.0.0.0/0. certbot's HTTP-01 challenge needs :80.

sudo systemctl enable --now nginx

# Issue ONE cert covering apex + www (single cert, two SAN names)
sudo certbot --nginx -d molamaker.cn -d www.molamaker.cn \
  --non-interactive --agree-tos -m you@example.com --redirect

# Auto-renew is installed as a systemd timer; verify:
sudo certbot renew --dry-run
```

If certbot fails the challenge: confirm DNS (Phase 1) resolves to this box and
that :80 is reachable from the internet (`curl -I http://molamaker.cn` from your
laptop should hit nginx, not time out).

---

# PHASE 3 — nginx config (fixes #5, enables Secure cookies for #3) (10 min)

Write `/etc/nginx/conf.d/molamaker.conf` (or replace the server block certbot
made). This is the **Option A** version (chunks served by Node, no CDN skew):

```nginx
# ---- 80 → 443, both hosts ----
server {
  listen 80;
  listen [::]:80;
  server_name molamaker.cn www.molamaker.cn;
  return 308 https://molamaker.cn$request_uri;
}

# ---- www (443) → apex (443) ----
server {
  listen 443 ssl;
  listen [::]:443 ssl;
  http2 on;
  server_name www.molamaker.cn;
  ssl_certificate     /etc/letsencrypt/live/molamaker.cn/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/molamaker.cn/privkey.pem;
  return 308 https://molamaker.cn$request_uri;
}

# ---- apex (443) → Node app (the real server) ----
server {
  listen 443 ssl;
  listen [::]:443 ssl;
  http2 on;
  server_name molamaker.cn;

  ssl_certificate     /etc/letsencrypt/live/molamaker.cn/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/molamaker.cn/privkey.pem;
  ssl_protocols TLSv1.2 TLSv1.3;

  # GeoGebra/photo are on the CDN, but body HTML/JSON still benefit:
  gzip on;
  gzip_types text/plain application/json application/javascript text/css image/svg+xml application/rss+xml;

  client_max_body_size 25m;   # AstrBot file uploads

  # OPTION A: serve build chunks from the Node app (no CDN, no skew).
  # Long cache because filenames are content-hashed and immutable.
  location /_next/static/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    add_header Cache-Control "public, max-age=31536000, immutable";
  }

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;   # ← REQUIRED: lets the app set Secure cookies (#3)
    proxy_set_header Upgrade           $http_upgrade;
    proxy_set_header Connection        "";        # SSE: no keep-alive close
    proxy_buffering off;                          # SSE: stream immediately
    proxy_read_timeout 300s;                      # Math SSE runs up to 150s — 60s default would cut it
    proxy_send_timeout 300s;
  }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### If you choose Option B (CDN for chunks) instead

Replace the `location /_next/static/` block with a proxy to the CDN:

```nginx
  location /_next/static/ {
    proxy_pass https://cdn.molamaker.cn/_next/static/;
    proxy_set_header Host cdn.molamaker.cn;
    proxy_ssl_server_name on;
    proxy_intercept_errors on;
    # Fallback to the Node app if the CDN is missing this build's chunk:
    error_page 404 = @chunk_origin;
    add_header Cache-Control "public, max-age=31536000, immutable";
  }
  location @chunk_origin {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
  }
```

The `error_page 404 → @chunk_origin` fallback is your safety net against build
skew — if the CDN doesn't have a chunk, nginx silently serves it from Node
instead of 404ing the browser. Strongly recommended if you go with B.

---

# PHASE 4 — ECS runtime env (fixes #3 at the source) (5 min)

The code now **fails open** so a missing limiter backend won't 429-lock logins —
but set these so auth, sessions, and the limiter actually work:

```bash
cd /var/www/molamaker
# Edit .env (read by `next start`; do NOT put NEXT_PUBLIC_* CDN vars here —
# those were baked in at build time on your Windows machine).
nano .env
```

Minimum to make login work:

```bash
# Supabase (sessions, rate-limit, workplace data)
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>     # rate-limit.ts needs this; missing = limiter no-ops (now safe)

# Session signing — MUST set, or cookies sign with the insecure dev default
WORKPLACE_SESSION_SECRET=<openssl rand -hex 32>

# Who becomes owner on first login + the admin-key tab
WORKPLACE_OWNER_PHONE=+86...
WORKPLACE_ADMIN_KEY=<openssl rand -hex 32>       # blank disables the Admin tab

# Visitor mode works with NONE of the above (open viewer session) once the
# limiter is non-blocking — which the code fix already guarantees.
```

Apply the `check_rate` migration so the limiter returns real rows (otherwise it
just fails open every call — functional, but no actual throttling):

```bash
# From your LOCAL machine (has the Supabase CLI + linked project):
npm run db:push
# or paste supabase/migrations/*check_rate* into the Supabase SQL editor.
```

Then restart the app to pick up env:

```bash
pm2 restart molamaker --update-env
pm2 save
```

---

# PHASE 5 — build locally → ship to ECS + CDN (the release) (10–15 min)

### 5a. Build on your Windows machine

```powershell
cd E:\Portaitsweb\molamaker-site
npm ci
npm run build          # reads .env.production.local → CDN URLs for public/ assets inlined
# note the build id:
type .next\BUILD_ID
```

### 5b. Upload `public/` to COS — ONCE (156 MB; only re-upload when assets change)

Install coscmd (`pip install coscmd`) and configure it for your bucket/region:

```bash
coscmd config -a <SecretId> -s <SecretKey> -b <bucket-appid> -r <region>   # e.g. ap-shanghai
```

Upload, preserving structure (COS path mirrors local `public/` under `/public`):

```bash
coscmd upload -r public/geogebra /public/geogebra     # 115 MB — the big one, rarely changes
coscmd upload -r public/photo    /public/photo        # 36 MB
coscmd upload -r public/live2d   /public/live2d
coscmd upload -r public/redesign /public/redesign
coscmd upload -r public/journey  /public/journey
```

### 5c. Upload THIS build's chunks (only needed for Option B)

```bash
# Option A (Node serves chunks): SKIP this — nothing to upload.
# Option B (CDN serves chunks): upload every build, names are hashed.
coscmd upload -r .next/static /_next/static
```

### 5d. Tencent CDN + COS settings (one-time, in the Tencent console)

CDN domain `cdn.molamaker.cn` → **origin = the COS bucket**. Then:

- **CORS (COS → 安全管理 → 跨域访问CORS设置):** allow
  `Access-Control-Allow-Origin: https://molamaker.cn` (add `https://www.molamaker.cn`
  if you ever serve it), methods `GET, HEAD`, `Access-Control-Allow-Headers: *`.
  Required on `/public/*` (geogebra/live2d/fonts load cross-origin) **and**
  `/_next/static/*` if Option B.
- **Cache (CDN → 缓存配置):** `/_next/static/*` and `/public/geogebra/*` →
  cache 1 year (content-hashed/immutable). Other `/public/*` → your call.
- This GeoGebra bundle is **pure-JS (GWT), no `.wasm`** → no content-type worry.
  (If you ever swap in a wasm build, serve `.wasm` as `application/wasm`.)

### 5e. Verify the CDN before shipping the server

```bash
# Full check (public + _next/static) — Option B:
node scripts/verify-cdn.mjs --base https://cdn.molamaker.cn
# Option A (Node serves chunks) — check only the stable public tree:
node scripts/verify-cdn.mjs --base https://cdn.molamaker.cn --public-only
```

It HEAD-checks every file and prints `ok/missing/other` per tree, plus the CORS
`ACAO` header. **Do not proceed if `public/` shows missing files or CORS `(none)`**
— geogebra/fonts will fail in the browser. (For Option B, the `_next/static`
tree must be clean for the build you're about to ship.)

### 5f. Ship the server bundle to ECS + reload

```bash
# Git Bash on Windows (the repo already has this helper):
ECS=root@<ECS-IP> APP_DIR=/var/www/molamaker bash deploy/push-ecs.sh
```

It tars `.next public content package.json package-lock.json next.config.mjs i18n`,
streams over SSH, removes the old `.next` first (so stale chunks die), then runs
`npm ci --omit=dev && pm2 reload molamaker`. (`npm ci` rebuilds native deps for
Linux since you built on Windows.)

---

# PHASE 6 — smoke test (5 min)

From your **laptop** (real DNS), not the box:

```bash
curl -I http://molamaker.cn            # 308 → https://molamaker.cn
curl -I https://www.molamaker.cn       # 308 → https://molamaker.cn
curl -I https://molamaker.cn           # 200, valid cert, no warning
# Confirm the running build matches what you shipped:
curl -s https://molamaker.cn/en | grep -o '/_next/static/[A-Za-z0-9_-]\{8,\}/' | head -1
ssh root@<ECS-IP> 'cat /var/www/molamaker/.next/BUILD_ID'   # must match the chunk path above
```

In a browser (Edge + Chrome):

- [ ] **Padlock shows** on Edge — #4 fixed; the COOP "untrustworthy origin"
      console error is gone.
- [ ] **apex / www / http / https all land** on the app — #5 fixed.
- [ ] **Opening scene → click/Enter enters the site**; no frozen overlay — #1
      fixed (no chunk 404s in the Network tab; every `/_next/static/...` is 200).
- [ ] **No `/_vercel/*/script.js` 404s** in console — #2 noise gone (code gates
      them off the ECS build).
- [ ] **Workplace → Visitor "Enter as visitor"** lets you in (open viewer
      session); **Admin password** and **Phone OTP** work — #3 fixed. After login,
      `GET /api/workplace/auth/me` returns 200, not 401.
- [ ] DevTools → Application → Cookies → `wp-session` is present, `Secure ✓`,
      `HttpOnly ✓`, `SameSite=Lax`, Domain `molamaker.cn`.

```bash
ssh root@<ECS-IP> 'pm2 logs molamaker --lines 60 --nostream'   # check for runtime errors
```

---

# PHASE 7 — clean stale artifacts on the box (2 min)

~100 MB of stale build trees on your local machine were already deleted +
gitignored. Make sure none linger on ECS where a wrong one could be re-shipped:

```bash
ssh root@<ECS-IP>
cd /var/www/molamaker
ls -la                       # expect: .next public content package*.json next.config.mjs i18n  (+ data/, .env)
rm -rf _next .next.zip deploy-bundle.tar.gz deploy/.next 2>/dev/null
du -sh .next                 # sanity: one current build tree only
```

`data/` (workplace-settings.json, rate-limit fallback) must persist — put it on a
backed-up volume; `push-ecs.sh` does NOT delete it.

---

# Quick reference — which phase fixes which symptom

| Symptom | Fixed by |
|---------|----------|
| #4 connection unsafe (Edge) | Phase 2 (cert) + Phase 3 (443) |
| #5 can't enter http/https/www | Phase 1 (DNS) + Phase 2 (SAN) + Phase 3 (redirects) |
| #3 auth fails (pwd + visitor) | code fix (fail-open) + Phase 4 (env) + `X-Forwarded-Proto` in Phase 3 |
| #1 frozen opening | Phase 3 Option A (or B + fallback) + Phase 5e verify + Phase 6 build-id match |
| #2 two JS copies | code fix (gate Vercel scripts) + Phase 5 single-build discipline + Phase 7 cleanup |

# Recurring releases (after first recovery)

```
1. npm run build                      (Windows; note BUILD_ID)
2. coscmd upload .next/static …       (Option B only)
3. coscmd upload public/* …           (only changed asset trees)
4. node scripts/verify-cdn.mjs …      (must be clean)
5. bash deploy/push-ecs.sh            (ship .next + reload pm2)
6. curl smoke test + BUILD_ID match
```
Hashed chunk paths mean leftover old chunks are harmless; the fatal case is a
**missing** new-build chunk → keep the Option B nginx 404-fallback as insurance.
