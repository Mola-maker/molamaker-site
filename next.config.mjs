import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

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
    const isDev = process.env.NODE_ENV !== 'production';
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://giscus.app https://va.vercel-scripts.com"
      : "script-src 'self' 'unsafe-inline' https://giscus.app https://va.vercel-scripts.com";
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              scriptSrc,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.loli.net",
              "img-src 'self' data: https:",
              "font-src 'self' https://fonts.gstatic.com https://gstatic.loli.net",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.github.com https://va.vercel-scripts.com",
              "frame-src https://giscus.app",
              "object-src 'none'",
              "base-uri 'self'"
            ].join('; ')
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
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
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-origin'
          }
        ]
      }
    ];
  }
};
export default withNextIntl(nextConfig);
