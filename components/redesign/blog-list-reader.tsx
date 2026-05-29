'use client';

import { useEffect, useState } from 'react';
import { TopNav, Footer } from './chrome';
import { molaData, type Locale } from './data';
import { ReadingGraph } from '@/components/reading-graph';

type PostMeta = { slug: string; title: string; date: string; read_time: number; excerpt: string; tag?: string };

type Props = { posts: PostMeta[]; locale: Locale };

export default function BlogListReader({ posts, locale }: Props) {
  const [showNav, setShowNav] = useState(false);
  const i18n = molaData.i18n[locale];
  const home = `/${locale}`;

  useEffect(() => {
    document.body.classList.add('redesign-on');
    const tid = setTimeout(() => setShowNav(true), 200);
    return () => {
      document.body.classList.remove('redesign-on');
      clearTimeout(tid);
    };
  }, []);

  return (
    <>
      {showNav && <TopNav locale={locale} onLocale={() => {}} t={i18n} />}
      <div className="variant-stage is-in">
        <div className="miku-backdrop"></div>
        <div className="wrap">
          <section className="blog-list">
            <a href={home} className="blog-back" data-magnet>← home</a>
            <div className="blog-article__meta">Journal</div>
            <h1 className="blog-article__title" style={{ marginBottom: 36 }}>Writing</h1>

            {posts.length === 0 && (
              <p style={{ color: 'var(--ink-soft)', fontSize: 15 }}>
                No posts yet. Add markdown files to <code>content/</code>.
              </p>
            )}

            <ReadingGraph
              posts={posts.map((p) => ({ slug: p.slug, title: p.title, tag: p.tag ?? 'notes', read_time: p.read_time }))}
              locale={locale}
            />

            <div className="blog-list__grid">
              {posts.map((p) => (
                <a key={p.slug} href={`/${locale}/blog/${p.slug}`} className="blog-card" data-magnet>
                  <div className="blog-card__date">{p.date}</div>
                  <div className="blog-card__title">{p.title}</div>
                  <div className="blog-card__excerpt">{p.excerpt}</div>
                  <div className="blog-card__meta">{p.read_time} min read</div>
                </a>
              ))}
            </div>
          </section>
        </div>
      </div>
      <Footer t={i18n} />
    </>
  );
}
