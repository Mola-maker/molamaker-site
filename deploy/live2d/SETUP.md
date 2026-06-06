# Live2D mascot (self-host)

The bottom-left corner character is **stevenjoezhang/live2d-widget**, loaded by
`components/redesign/live2d-widget.tsx`. Out of the box it loads from the public
CDN (jsDelivr) with a default model and lands **bottom-left** (clear of the
bottom-right AstrBot dock). Workflow message-bus events surface as its speech
via the widget's `showMessage()`.

For mainland China, the CDN + default model host (jsDelivr / `fghrsh/live2d_api`)
are slow/blocked — host a copy on your ECS or Aliyun OSS, the same as GeoGebra.

## 1. Build / fetch the widget `dist`

```bash
git clone https://github.com/stevenjoezhang/live2d-widget
cd live2d-widget
npm install && npm run build      # produces dist/  (autoload.js, waifu.js, css, …)
```

Or grab the published package's `dist/` from npm (`live2d-widgets`).

## 2. Choose + host a model

The widget pulls model files (`model_list.json`, model JSON, textures) from a
model API — default `fghrsh/live2d_api`. Self-host one:

```bash
git clone https://github.com/fghrsh/live2d_api      # or any Live2D model set
# serve it on the ECS, e.g. /var/www/live2d/api/
```

In the widget's config (`autoload.js` / `initWidget({ cdnPath / apiPath })`),
point the model path at your host. Edit before building, or self-host the whole
`live2d_api` and set its base.

## 3. Serve on ECS (nginx) with CORS

```bash
sudo mkdir -p /var/www/live2d
sudo cp -r live2d-widget/dist/*  /var/www/live2d/      # autoload.js at the root
sudo cp -r live2d_api            /var/www/live2d/api/  # models
```

```nginx
location /live2d/ {
    alias /var/www/live2d/;
    add_header Access-Control-Allow-Origin "*" always;   # public static assets
    add_header Cache-Control "public, max-age=604800";
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
curl -I https://bot.molamaker.com/live2d/autoload.js     # 200 + ACAO
```

## 4. Point the app at your copy

`.env.local` (local) and the build env — folder that serves `autoload.js`, no
trailing slash:

```bash
NEXT_PUBLIC_LIVE2D_BASE=https://bot.molamaker.com/live2d
```

`NEXT_PUBLIC_*` is build-time → rebuild after setting it.

## Outfit switch (换装)

The **coat icon** on the right toolbar cycles `paths[]` for the current model.
Models with only one path show「我还没有其他衣服呢！」— defaults are ordered in
`public/live2d/waifu-tips.json` (HyperdimensionNeptunia first, many outfits).

If switching still fails after deploy:

1. Hard-refresh the page (widget scripts are cached).
2. Reset widget state in DevTools → Application → Local Storage: delete
   `modelId` and `modelTexturesId`, then reload.
3. If models never load, self-host `fghrsh/live2d_api` and set `cdnPath` in
   `public/live2d/autoload.js` (see step 2 above).

## Toolbar tools

`public/live2d/autoload.js` intentionally omits **hitokoto** and **asteroids**:
they `fetch('https://v1.hitokoto.cn')` or load extra scripts and surface
`TypeError: Failed to fetch` when the network or security headers block them.
Chat is handled by AstrBot (`Live2DChat`), not the widget toolbar.

## Notes
- **Position / model** are configured in `public/live2d/autoload.js` and
  `waifu-tips.json` (`modelId` / `models[]`).
- `next.config.mjs` uses `Cross-Origin-Resource-Policy: cross-origin` so
  jsDelivr model JSON/textures are not blocked by CORP.
- On phones the widget can crowd the screen; live2d-widget supports a mobile
  hide option, or add `@media (max-width: 768px){ #waifu{ display:none } }`.
- The old gif mascot component (`workplace-mascot.tsx`) is no longer imported —
  safe to delete.
