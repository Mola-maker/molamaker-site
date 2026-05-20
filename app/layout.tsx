import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
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
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=DM+Sans:opsz,wght@9..40,300..600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
