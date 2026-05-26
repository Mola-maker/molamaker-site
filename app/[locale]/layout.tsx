import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { routing } from '@/i18n/routing';
import Konami from '@/components/konami';
// CursorGlow / ScrollReveal / ReturnToOpening removed — the redesign provides
// its own Cursor, IntersectionObserver-based reveal, and Opening2 sequence.

// Fonts: Fraunces / DM Sans / JetBrains Mono loaded from fonts.loli.net
// (a CN-accessible mirror of Google Fonts). Avoids fonts.googleapis.com
// which is blocked in mainland China and was causing 4×3s timeouts on
// every dev compile and ECS build. The CSS variables --font-serif /
// --font-sans / --font-mono are defined in app/globals.css :root with
// the Google font as primary and system fallbacks behind it.

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://molamaker-site.vercel.app'),
  title: 'molamaker — portfolio & journal',
  description: 'Building at the edge of systems and intelligence.',
  openGraph: {
    title: 'molamaker',
    description: 'Portfolio & journal of a developer working at the edge of systems and intelligence.',
    type: 'website',
  },
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as 'en' | 'zh')) notFound();

  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        <link rel="alternate" type="application/rss+xml" title="molamaker journal" href="/rss.xml" />
        <link rel="preconnect" href="https://fonts.loli.net" />
        <link rel="preconnect" href="https://gstatic.loli.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.loli.net/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,300;1,9..144,400;1,9..144,600&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <NextIntlClientProvider messages={messages}>
          <Konami />
          {children}
        </NextIntlClientProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
