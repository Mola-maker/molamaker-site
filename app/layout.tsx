import type { Metadata, Viewport } from 'next';
import { Fraunces, DM_Sans, JetBrains_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import CursorGlow from '@/components/cursor-glow';
import ScrollReveal from '@/components/scroll-reveal';
import Konami from '@/components/konami';
import './globals.css';

const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-serif',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
  weight: ['400', '500'],
});

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://molamaker-site.vercel.app'),
  title: 'molamaker — portfolio & journal',
  description: 'Building at the edge of systems and intelligence.',
  openGraph: {
    title: 'molamaker',
    description: 'Portfolio & journal of a developer working at the edge of systems and intelligence.',
    type: 'website'
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="alternate" type="application/rss+xml" title="molamaker journal" href="/rss.xml" />
      </head>
      <body>
        <CursorGlow />
        <ScrollReveal />
        <Konami />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
