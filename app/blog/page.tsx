import type { Metadata } from 'next';
import { getPosts } from '@/lib/data/posts';
import Nav from '@/components/nav';
import Footer from '@/components/footer';

export const revalidate = 60;

export const metadata: Metadata = { title: 'Blog — molamaker' };

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });

export default async function BlogPage() {
  const posts = await getPosts();

  return (
    <>
      <Nav />
      <main>
        <section>
          <div className="label">03 — Journal</div>
          <h2>Writing about systems, intelligence, and the messy seams.</h2>

          {posts.length === 0 && (
            <p style={{ color: 'var(--ink-soft)', fontSize: 15 }}>
              No posts yet. Run the seed in <code>supabase/schema.sql</code> or
              add some via the dashboard.
            </p>
          )}

          {posts.map((p) => (
            <a key={p.slug} href={`/blog/${p.slug}`} className="post">
              <div className="post-date">{fmtDate(p.published_at)}</div>
              <div className="post-title">{p.title}</div>
              <div className="post-meta">
                {p.read_time} min &middot; {p.view_count.toLocaleString()} views
              </div>
            </a>
          ))}
        </section>
      </main>
      <Footer />
    </>
  );
}
