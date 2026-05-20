'use client';

import dynamic from 'next/dynamic';

const AnnotationSidebar = dynamic(
  () => import('@/components/annotation-sidebar'),
  { ssr: false }
);

export default function AnnotationSidebarWrapper() {
  return <AnnotationSidebar />;
}
