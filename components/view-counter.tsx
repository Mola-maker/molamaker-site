'use client';

import { useEffect } from 'react';

export default function ViewCounter({ slug }: { slug: string }) {
  useEffect(() => {
    fetch('/api/views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: `/blog/${slug}` }),
    }).catch(() => {});
  }, [slug]);

  return null;
}
