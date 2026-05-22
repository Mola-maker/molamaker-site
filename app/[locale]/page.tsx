import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { getAllPosts } from '@/lib/content';
import { getEntries } from '@/lib/data/guestbook';
import { getTotalViews } from '@/lib/data/page-views';
import NavWrapper from '@/components/nav-wrapper';
import Hero from '@/components/hero';
import HeroAnimation from '@/components/hero-animation';
import Footer from '@/components/footer';
import { HeroSkeleton, WritingSkeleton, GuestbookSkeleton } from '@/components/skeletons';
import { Link } from '@/i18n/routing';

export const revalidate = 30;

async function HeroAsync() {
  const visitorCount = await getTotalViews();
  return (
    <HeroAnimation>
      <Hero visitorCount={visitorCount || 1247} />
    </HeroAnimation>
  );
}

async function FeaturedPosts() {
  const t = await getTranslations('home');
  const posts = (await getAllPosts()).slice(0, 3);
  if (posts.length === 0) return null;
  return (
    <section>
      <div className="label">{t('recentWriting')}</div>
      <h2>{t('fromTheJournal')}</h2>
      <div>
        {posts.map((p) => (
          <Link key={p.slug} href={`/blog/${p.slug}`} className="post">
            <div className="post-date">{new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}</div>
            <div className="post-title">{p.title}</div>
            <div className="post-meta">{p.read_time} {t('minRead')}</div>
          </Link>
        ))}
      </div>
      <p style={{ marginTop: 24 }}>
        <Link href="/blog" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 14 }}>{t('readTheJournal')}</Link>
      </p>
    </section>
  );
}

async function GuestbookTeaser() {
  const t = await getTranslations('home');
  const entries = await getEntries(3);
  return (
    <section>
      <div className="label">{t('guestbook')}</div>
      <h2>{t('leaveATrace')}</h2>
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
        <Link href="/guestbook" style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 14 }}>{t('signTheGuestbook')}</Link>
      </p>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <NavWrapper />
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
