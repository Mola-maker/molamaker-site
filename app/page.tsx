import { Suspense } from 'react';
import { getPosts } from '@/lib/data/posts';
import { getEntries } from '@/lib/data/guestbook';
import { getTotalViews } from '@/lib/data/page-views';
import Nav from '@/components/nav';
import Hero from '@/components/hero';
import About from '@/components/about';
import Work from '@/components/work';
import Writing from '@/components/writing';
import Guestbook from '@/components/guestbook';
import Contact from '@/components/contact';
import Footer from '@/components/footer';
import { HeroSkeleton, WritingSkeleton, GuestbookSkeleton } from '@/components/skeletons';

export const revalidate = 30; // ISR: refresh every 30s

// ── data-dependent async wrappers (each streams independently) ──

async function HeroAsync() {
  const visitorCount = await getTotalViews();
  return <Hero visitorCount={visitorCount || 1247} />;
}

async function WritingAsync() {
  const posts = await getPosts(5);
  return <Writing posts={posts} />;
}

async function GuestbookAsync() {
  const entries = await getEntries(30);
  return <Guestbook entries={entries} />;
}

// ── page shell (static content renders immediately) ──

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Suspense fallback={<HeroSkeleton />}>
          <HeroAsync />
        </Suspense>
        <About />
        <Work />
        <Suspense fallback={<WritingSkeleton />}>
          <WritingAsync />
        </Suspense>
        <Suspense fallback={<GuestbookSkeleton />}>
          <GuestbookAsync />
        </Suspense>
        <Contact />
      </main>
      <Footer />
    </>
  );
}
