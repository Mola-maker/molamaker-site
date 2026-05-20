'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { savePost } from '@/app/admin/actions';
import type { Post } from '@/lib/types';

interface Props {
  post?: Post | null;
}

export function PostForm({ post }: Props) {
  const router = useRouter();
  const isNew = !post;
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    try {
      await savePost(formData);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      {post && <input type="hidden" name="existing_slug" value={post.slug} />}

      <div className="admin-form-group">
        <label className="label" htmlFor="title">
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          defaultValue={post?.title ?? ''}
          required
        />
      </div>

      <div className="admin-form-group">
        <label className="label" htmlFor="slug">
          Slug
        </label>
        <input
          id="slug"
          name="slug"
          type="text"
          defaultValue={post?.slug ?? ''}
          required
        />
      </div>

      <div className="admin-form-group">
        <label className="label" htmlFor="excerpt">
          Excerpt
        </label>
        <textarea
          id="excerpt"
          name="excerpt"
          rows={2}
          defaultValue={post?.excerpt ?? ''}
        />
      </div>

      <div className="admin-form-group">
        <label className="label" htmlFor="content">
          Content
        </label>
        <textarea
          id="content"
          name="content"
          rows={16}
          defaultValue={post?.content ?? ''}
        />
      </div>

      <div className="admin-form-row">
        <div className="admin-form-group" style={{ maxWidth: 140 }}>
          <label className="label" htmlFor="read_time">
            Read time (min)
          </label>
          <input
            id="read_time"
            name="read_time"
            type="number"
            min={0}
            defaultValue={post?.read_time ?? 5}
          />
        </div>

        <div className="admin-form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 }}>
          <input
            id="published"
            name="published"
            type="checkbox"
            defaultChecked={post?.published !== false}
            style={{ width: 18, height: 18, accentColor: 'var(--accent)' }}
          />
          <label className="label" htmlFor="published" style={{ marginBottom: 0 }}>
            Published
          </label>
        </div>
      </div>

      <div className="admin-form-actions">
        <button className="send" type="submit" disabled={saving}>
          {saving ? 'Saving...' : isNew ? 'Create Post' : 'Save Changes'}
        </button>
        <button
          type="button"
          className="admin-btn"
          onClick={() => router.push('/admin')}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
