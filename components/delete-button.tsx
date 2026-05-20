'use client';

import { useRouter } from 'next/navigation';
import { deletePost } from '@/app/admin/actions';

export function DeleteButton({ slug, title }: { slug: string; title: string }) {
  const router = useRouter();

  return (
    <button
      onClick={async () => {
        if (!confirm(`Delete "${title}"?`)) return;
        await deletePost(slug);
        router.refresh();
      }}
      className="admin-btn admin-btn-danger"
    >
      Delete
    </button>
  );
}
