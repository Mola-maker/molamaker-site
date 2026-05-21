import './globals.css';

/**
 * Minimal root layout — required by Next.js 15 App Router.
 *
 * The actual <html>, <body>, fonts, metadata, and NextIntlClientProvider
 * live in app/[locale]/layout.tsx. This file must exist (Next.js requires
 * a root layout for global CSS imports) but delegates all rendering.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
