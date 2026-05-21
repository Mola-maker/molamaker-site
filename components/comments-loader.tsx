'use client';

import dynamic from 'next/dynamic';

const Comments = dynamic(() => import('@/components/comments'), { ssr: false });

export default function CommentsLoader() {
  return <Comments />;
}
