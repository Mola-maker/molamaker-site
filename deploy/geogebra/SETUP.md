# Self-hosting GeoGebra (Workplace → Math)

## Why

The Math panel loads the GeoGebra applet from `cdn.geogebra.org`, which is slow
or blocked in mainland China. Hosting the **GeoGebra Math Apps Bundle** yourself
(on the Aliyun ECS box or Aliyun OSS) removes that third-party dependency.

The app already supports this: set `NEXT_PUBLIC_GEOGEBRA_BASE_URL` to your mirror
and `workplace-math.tsx` loads from it first (pinning the app codebase to the
mirror via `setHTML5Codebase`), falling back to the public CDNs only if your
mirror is unreachable, with a Retry on total failure.

---

## 1. Download the bundle  ← you don't need an OS installer

You do **not** want the Windows/macOS/Linux items on the download page — those
are the *desktop application*. What you self-host is the **Math Apps Bundle**: a
platform-independent `.zip` of web files (HTML/JS/wasm) that any web server
(nginx on Ubuntu, OSS, etc.) serves as static files.

Direct download (OS-independent):

```
https://download.geogebra.org/package/geogebra-math-apps-bundle
```

(Official guide: "How to Self-Host GeoGebra Applets" — https://www.geogebra.org/m/K7gT3sUb)

Unzipped, it contains a **`GeoGebra/`** folder:

```
GeoGebra/
  deployggb.js
  HTML5/5.0/web3d/...          # the applet + wasm + sworker-locked.js
  HTML5/5.0/...
```

> License: GeoGebra is free for non-commercial use — review the terms before
> redistributing: https://www.geogebra.org/license

**The mirror base** you point the app at = the URL that serves that `GeoGebra/`
folder, i.e. the folder where `deployggb.js` lives. The app expects both
`<base>/deployggb.js` and `<base>/HTML5/5.0/web3d/` to resolve.

---

## 2a. Host on ECS (nginx)

```bash
sudo mkdir -p /var/www/geogebra
sudo apt install -y unzip
sudo unzip GeoGebra-*.zip -d /var/www/geogebra      # creates /var/www/geogebra/GeoGebra/
sudo chown -R www-data:www-data /var/www/geogebra
```

Serve the `GeoGebra/` folder at `/geogebra/` and allow cross-origin loading
(your site runs on a different origin — Vercel):

```nginx
location /geogebra/ {
    alias /var/www/geogebra/GeoGebra/;       # note the inner GeoGebra/ folder
    add_header Access-Control-Allow-Origin "https://molamaker.com" always;
    add_header Cache-Control "public, max-age=31536000, immutable";
    # Ensure .wasm is application/wasm (recent nginx mime.types include it;
    # add to http{} types if not): types { application/wasm wasm; }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
curl -I https://bot.<domain>/geogebra/deployggb.js   # 200 + ACAO header
curl -I https://bot.<domain>/geogebra/HTML5/5.0/web3d/web3d.nocache.js  # 200
```

## 2b. Or host on Aliyun OSS (+ optional CDN)

1. Upload the **unzipped** `GeoGebra/` folder to a bucket (keep the structure).
2. Bucket → 权限管理 → 跨域设置 (CORS): allow `GET` from `https://molamaker.com`.
3. (Optional) front it with Aliyun CDN for speed.
4. Base = the URL of the folder serving `deployggb.js`, e.g.
   `https://<bucket>.oss-cn-hangzhou.aliyuncs.com/geogebra`.

---

## 3. Point the app at your mirror

In `.env.local` (local) **and** Vercel → Environment Variables (prod), set the
folder that serves `deployggb.js` — **no trailing slash**:

```bash
NEXT_PUBLIC_GEOGEBRA_BASE_URL=https://bot.molamaker.com/geogebra
```

`NEXT_PUBLIC_*` is inlined at build time → **rebuild/redeploy** after setting it.

---

## 4. Verify

- Workplace → Math: the canvas renders the GeoGebra applet.
- DevTools → Network: `deployggb.js` and `HTML5/5.0/web3d/*` load from **your**
  host (not cdn.geogebra.org), status 200, no CORS errors.
- Kill the mirror and reload → it auto-falls back to the public CDN; if that's
  blocked too, you get "Could not load GeoGebra from any source" + Retry —
  never an infinite "Loading…".

## Notes / gotchas

- **Service worker:** GeoGebra registers `sworker-locked.js` for offline caching.
  Service workers must be **same-origin** with the page, so when GeoGebra is
  served from a *different* origin than the site, that registration is blocked by
  the browser. This is harmless — the applet still runs; you just lose offline
  caching. (To keep the SW, host the bundle on the *same* origin as the site,
  e.g. under the Next app's `public/geogebra/` — at the cost of repo size and,
  if the site itself is on Vercel, the same China-reachability problem.)
- Must use the **bundle's** `deployggb.js`, not the CDN copy (the app pins the
  codebase to your mirror automatically for the self-hosted source).

## Checklist

- [ ] `curl -I <base>/deployggb.js` → 200 with `Access-Control-Allow-Origin`
- [ ] `curl -I <base>/HTML5/5.0/web3d/web3d.nocache.js` → 200
- [ ] `.wasm` served as `application/wasm`
- [ ] `NEXT_PUBLIC_GEOGEBRA_BASE_URL` set in build env, redeployed
- [ ] Network tab shows GeoGebra loading from your mirror
