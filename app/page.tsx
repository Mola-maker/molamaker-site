import { Suspense } from 'react';
import { getPosts } from '@/lib/data/posts';
import { getEntries } from '@/lib/data/guestbook';
import { getTotalViews } from '@/lib/data/page-views';
import Nav from '@/components/nav';
import Hero from '@/components/hero';
import Footer from '@/components/footer';
import { HeroSkeleton, WritingSkeleton, GuestbookSkeleton } from '@/components/skeletons';
import Link from 'next/link';

export const revalidate = 30;

async function HeroAsync() {
  const visitorCount = await getTotalViews();
  return <Hero visitorCount={visitorCount || 1247} />;
}

async function FeaturedPosts() {
  const posts = await getPosts(3);
  if (posts.length === 0) return null;
  return (
    <section>
      <div className="label">Recent writing</div>
      <h2>From the journal.</h2>
      <div>
        {posts.map((p) => (
          <Link key={p.slug} href={`/blog/${p.slug}`} className="post">
            <div className="post-date">{new Date(p.published_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}</div>
            <div className="post-title">{p.title}</div>
            <div className="post-meta">{p.read_time} min · {p.view_count.toLocaleString()} views</div>
          </Link>
        ))}
      </div>
      <p style={{ marginTop: 24 }}>
        <Link href="/blog" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 14 }}>Read the journal →</Link>
      </p>
    </section>
  );
}

async function GuestbookTeaser() {
  const entries = await getEntries(3);
  return (
    <section>
      <div className="label">Guestbook</div>
      <h2>Leave a trace.</h2>
      <div>
        {entries.map((e) => (
          <div key={e.id} className="entry">
            <div className="entry-head">
              <span className="entry-name">{e.name}</span>
              <span className="entry-time">{new Date(e.created_at).toLocaleDateString()}</span>
            </div>
            <div className="entry-msg">{e.message}</div>
          </div>
        ))}
      </div>
      <p style={{ marginTop: 24 }}>
        <Link href="/guestbook" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 14 }}>Sign the guestbook →</Link>
      </p>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Suspense fallback={<HeroSkeleton />}>
          <HeroAsync />
        </Suspense>
        <Suspense fallback={<WritingSkeleton />}>
          <FeaturedPosts />
        </Suspense>
        <Suspense fallback={<GuestbookSkeleton />}>
          <GuestbookTeaser />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
