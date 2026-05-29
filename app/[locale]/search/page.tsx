import type { Metadata } from 'next';
import NavWrapper from '@/components/nav-wrapper';
import Footer from '@/components/footer';
import { SearchPanel } from '@/components/search-panel';
import { routing } from '@/i18n/routing';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { title: 'Search — molamaker' };

export default async function SearchPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as 'en' | 'zh')) notFound();
  return (
    <>
      <NavWrapper />
      <main>
        <SearchPanel locale={locale} />
      </main>
      <Footer />
    </>
  );
}
