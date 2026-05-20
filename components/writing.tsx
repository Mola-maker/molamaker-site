type Post = {
  slug: string;
  title: string;
  published_at: string;
  read_time: number;
  view_count: number;
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });

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
          <a key={p.slug} href={`/blog/${p.slug}`} className="post">
            <div className="post-date">{fmtDate(p.published_at)}</div>
            <div className="post-title">{p.title}</div>
            <div className="post-meta">
              {p.read_time} min · {p.view_count.toLocaleString()} views
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
