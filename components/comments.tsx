'use client';
import { useEffect, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';

export default function Comments() {
  const ref = useRef<HTMLDivElement>(null);
  const locale = useLocale();
  const t = useTranslations('comments');
  const repo = process.env.NEXT_PUBLIC_GISCUS_REPO;
  const repoId = process.env.NEXT_PUBLIC_GISCUS_REPO_ID;
  const categoryId = process.env.NEXT_PUBLIC_GISCUS_CATEGORY_ID;

  useEffect(() => {
    if (!repo || !repoId || !categoryId || !ref.current) return;
    const script = document.createElement('script');
    script.src = 'https://giscus.app/client.js';
    script.setAttribute('data-repo', repo);
    script.setAttribute('data-repo-id', repoId);
    script.setAttribute('data-category-id', categoryId);
    script.setAttribute('data-category', 'General');
    script.setAttribute('data-mapping', 'pathname');
    script.setAttribute('data-reactions-enabled', '1');
    script.setAttribute('data-emit-metadata', '0');
    script.setAttribute('data-theme', 'preferred_color_scheme');
    script.setAttribute('data-lang', locale === 'zh' ? 'zh-CN' : 'en');
    script.setAttribute('crossorigin', 'anonymous');
    script.async = true;
    ref.current.appendChild(script);
  }, [repo, repoId, categoryId, locale]);

  if (!repo || !repoId || !categoryId) return null;

  return (
    <section style={{ marginTop: 60, paddingTop: 40, borderTop: '1px solid var(--rule)' }}>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, marginBottom: 24 }}>{t('title')}</h2>
      <div ref={ref} />
    </section>
  );
}
