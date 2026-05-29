import type { Metadata } from 'next';
import NavWrapper from '@/components/nav-wrapper';
import Footer from '@/components/footer';
import { NowDashboard } from '@/components/now-dashboard';

export const metadata: Metadata = { title: 'Now — molamaker' };

export const dynamic = 'force-dynamic';

export default function NowPage() {
  return (
    <>
      <NavWrapper />
      <main>
        <NowDashboard />
      </main>
      <Footer />
    </>
  );
}
