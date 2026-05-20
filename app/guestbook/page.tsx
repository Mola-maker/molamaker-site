import type { Metadata } from 'next';
import { getEntries } from '@/lib/data/guestbook';
import Nav from '@/components/nav';
import Footer from '@/components/footer';
import Guestbook from '@/components/guestbook';

export const revalidate = 30;

export const metadata: Metadata = { title: 'Guestbook — molamaker' };

export default async function GuestbookPage() {
  const entries = await getEntries(50);

  return (
    <>
      <Nav />
      <main>
        <Guestbook entries={entries} />
      </main>
      <Footer />
    </>
  );
}
