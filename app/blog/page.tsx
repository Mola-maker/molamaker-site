import type { Metadata } from 'next';
import { getAllPosts } from '@/lib/content';
import NavWrapper from '@/components/nav-wrapper';
import Footer from '@/components/footer';

export const metadata: Metadata = { title: 'Blog — molamaker' };

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });

export default async function BlogPage() {
  const posts = getAllPosts();

  return (
    <>
      <NavWrapper />
      <main>
        <section>
          <div className="label">03 — Journal</div>
          <h2>Writing about systems, intelligence, and the messy seams.</h2>

          {posts.length === 0 && (
            <p style={{ color: 'var(--ink-soft)', fontSize: 15 }}>
              No posts yet. Add markdown files to <code>content/</code>.
            </p>
          )}

          {posts.map((p) => (
            <a key={p.slug} href={`/blog/${p.slug}`} className="post">
              <div className="post-date">{fmtDate(p.date)}</div>
              <div className="post-title">{p.title}</div>
              <div className="post-meta">{p.read_time} min read</div>
            </a>
          ))}
        </section>
      </main>
      <Footer />
    </>
  );
}
