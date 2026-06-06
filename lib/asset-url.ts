// Resolve a `public/` asset to the CDN in production, or same-origin in dev.
//
// Next's `assetPrefix` only rewrites `/_next/static`; files referenced by root
// path (e.g. `/redesign/x.gif`, `/photo/y.mp4`) are otherwise served by the Node
// origin (ECS). Wrap those refs in `assetUrl(...)` to serve them from the CDN.
//
// Set NEXT_PUBLIC_PUBLIC_ASSET_BASE to where `public/` is mirrored on the CDN,
// e.g. `https://cdn.molamaker.cn/public`. Unset (or in dev) → same-origin, so
// nothing changes locally. NEXT_PUBLIC_* is inlined at build time → rebuild
// after changing it.

const BASE = process.env.NEXT_PUBLIC_PUBLIC_ASSET_BASE?.replace(/\/+$/, '') ?? '';

/** Prefix a root-absolute public path with the CDN base (no-op when unset). */
export function assetUrl(path: string): string {
  if (!BASE || !path.startsWith('/')) return path;
  return `${BASE}${path}`;
}
