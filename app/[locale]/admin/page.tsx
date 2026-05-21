import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Link } from '@/i18n/routing';
import { DeleteButton } from '@/components/delete-button';
import type { Post } from '@/lib/types';

export const revalidate = 0;

export default async function AdminPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: posts, error } = await supabase
    .from('posts')
    .select('slug, title, published, published_at, read_time, view_count')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('slug', { ascending: true });

  if (error) {
    return (
      <div style={{ padding: '60px 0' }}>
        <div className="form-err">Failed to load posts: {error.message}</div>
      </div>
    );
  }

  const list = (posts ?? []) as Post[];

  return (
    <div style={{ padding: '40px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <div className="label">Admin</div>
          <h2>Posts</h2>
        </div>
        <Link href="/admin/new" className="send" style={{ textDecoration: 'none' }}>
          New Post
        </Link>
      </div>

      {list.length === 0 ? (
        <p style={{ color: 'var(--ink-soft)' }}>No posts yet.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Read</th>
              <th>Views</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.slug}>
                <td>
                  <Link
                    href={`/admin/edit/${p.slug}`}
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: 17,
                      fontWeight: 500,
                      color: 'var(--ink)',
                      textDecoration: 'none',
                    }}
                  >
                    {p.title}
                  </Link>
                </td>
                <td>
                  <span className={`admin-badge ${p.published ? 'admin-badge-live' : 'admin-badge-draft'}`}>
                    {p.published ? 'Published' : 'Draft'}
                  </span>
                </td>
                <td className="admin-mono">{p.read_time}m</td>
                <td className="admin-mono">{p.view_count.toLocaleString()}</td>
                <td>
                  <div className="admin-actions">
                    <Link href={`/admin/edit/${p.slug}`} className="admin-btn">
                      Edit
                    </Link>
                    <DeleteButton slug={p.slug} title={p.title} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
