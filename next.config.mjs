import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const isProd = process.env.NODE_ENV === 'production';

const originOf = (raw) => {
  try {
    if (raw && /^https?:\/\//i.test(raw.trim())) return new URL(raw.trim()).origin;
  } catch { /* ignore */ }
  return '';
};

// Tencent COS+CDN origin for public/ mirror (see lib/asset-url.ts).
// Must be allowed in the CSP below or the browser blocks the assets.
// NOTE: assetPrefix is intentionally NOT set — Next.js 16 (Turbopack) applies it
// inconsistently (some chunks get the prefix, some don't, some get both), causing
// duplicate chunk loads, two React instances, and a frozen page.
const assetOrigin = originOf(process.env.NEXT_PUBLIC_PUBLIC_ASSET_BASE);

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' }
    ]
  },
  async headers() {
    // Next.js 15 App Router streams RSC payload via inline <script> tags
    // (self.__next_f.push). Without 'unsafe-inline' the browser blocks them
    // and the page is blank. 'unsafe-eval' is only needed in dev for HMR.
    const isDev = !isProd;
    const ggbOrigin = (() => {
      try {
        const raw = process.env.NEXT_PUBLIC_GEOGEBRA_BASE_URL?.trim();
        if (raw && /^https?:\/\//i.test(raw)) return new URL(raw).origin;
      } catch { /* ignore */ }
      return '';
    })();
    const ggbCsp = ggbOrigin ? ` ${ggbOrigin}` : '';
    // CDN origin for mirrored public/ files (media/img/fonts).
    const cdnCsp = assetOrigin ? ` ${assetOrigin}` : '';
    // GeoGebra: same-origin /geogebra/ (WASM + blob workers). Optional mirror origin via env.
    const scriptSrc = isDev
      ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://giscus.app https://va.vercel-scripts.com https://fastly.jsdelivr.net https://cdn.geogebra.org https://www.geogebra.org https://cubism.live2d.com${cdnCsp}${ggbCsp}`
      : `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob: https://giscus.app https://va.vercel-scripts.com https://fastly.jsdelivr.net https://cdn.geogebra.org https://www.geogebra.org https://cubism.live2d.com${cdnCsp}${ggbCsp}`;
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              scriptSrc,
              `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.loli.net https://fastly.jsdelivr.net${cdnCsp}${ggbCsp}`,
              "img-src 'self' data: blob: https:",
              `media-src 'self' blob:${cdnCsp}`,
              `font-src 'self' data: https://fonts.gstatic.com https://gstatic.loli.net https://fastly.jsdelivr.net${cdnCsp}${ggbCsp}`,
              `connect-src 'self' blob: data: https://*.supabase.co wss://*.supabase.co https://api.github.com https://va.vercel-scripts.com https://fastly.jsdelivr.net https://cdn.jsdelivr.net https://cdn.geogebra.org https://www.geogebra.org https://cubism.live2d.com https://v1.hitokoto.cn${cdnCsp}${ggbCsp}`,
              `worker-src 'self' blob: https://cdn.geogebra.org https://www.geogebra.org${ggbCsp}`,
              `frame-src 'self' blob: https://giscus.app https://cdn.geogebra.org https://www.geogebra.org${ggbCsp}`,
              "object-src 'none'",
              "base-uri 'self'"
            ].join('; ')
          },
          // HSTS is only meaningful over HTTPS (browsers ignore it on HTTP) and is
          // actively harmful if emitted before TLS is solid. Gate it to prod and
          // DROP `preload` — preload submits the apex to the browsers' hard-coded
          // HSTS list, a months-to-reverse commitment that must be opt-in, not a
          // side effect of a header. Re-add `; preload` only after deliberately
          // submitting to hstspreload.org.
          ...(isProd
            ? [{
                key: 'Strict-Transport-Security',
                value: 'max-age=63072000; includeSubDomains'
              }]
            : []),
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), accelerometer=(), autoplay=(), clipboard-write=(), display-capture=(), payment=()'
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin'
          },
          {
            // Live2D models + Cubism SDK load from jsDelivr / live2d.com; same-origin
            // CORP blocks those fetches and surfaces as TypeError: Failed to fetch.
            key: 'Cross-Origin-Resource-Policy',
            value: 'cross-origin'
          }
        ]
      }
    ];
  }
};
export default withNextIntl(nextConfig);
