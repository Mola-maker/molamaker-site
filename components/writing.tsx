import { Link } from '@/i18n/routing';
import { fmtDate } from '@/lib/date';
import type { Post } from '@/lib/types';

export default function Writing({ posts }: { posts: Post[] }) {
  return (
    <section id="writing">
      <div className="label">03 — Writing</div>
      <h2>Recent posts.</h2>
      <div>
        {posts.length === 0 && (
          <p style={{ color: 'var(--ink-soft)', fontSize: 15 }}>
            No posts yet. Run the seed in <code>supabase/schema.sql</code> or
            add some via the dashboard.
          </p>
        )}
        {posts.map((p) => (
          <Link key={p.slug} href={`/blog/${p.slug}`} className="post">
            <div className="post-date">{fmtDate(p.published_at)}</div>
            <div className="post-title">{p.title}</div>
            <div className="post-meta">
              {p.read_time} min · {p.view_count.toLocaleString()} views
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
