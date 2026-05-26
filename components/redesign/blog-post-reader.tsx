'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { TopNav, Footer } from './chrome';
import { molaData, type Locale } from './data';

type PostProps = {
  title: string;
  date: string;
  readTime: number;
  excerpt: string;
  markdown: string;
  locale: Locale;
};

type TocEntry = { level: number; text: string; id: string };

function extractTOC(md: string): TocEntry[] {
  return md.split('\n').reduce<TocEntry[]>((acc, line) => {
    const m = line.match(/^(#{2,3})\s+(.+)$/);
    if (m) {
      const text = m[2].trim();
      const id = text.toLowerCase().replace(/[^\w一-龥\s-]/g, '').replace(/\s+/g, '-');
      acc.push({ level: m[1].length, text, id });
    }
    return acc;
  }, []);
}

function slugId(text: string) {
  return text.toLowerCase().replace(/[^\w一-龥\s-]/g, '').replace(/\s+/g, '-');
}

export default function BlogPostReader({ title, date, readTime, excerpt, markdown, locale }: PostProps) {
  const [showNav, setShowNav] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeId, setActiveId] = useState('');
  const articleRef = useRef<HTMLDivElement>(null);
  const i18n = molaData.i18n[locale];
  const home = `/${locale}`;
  const toc = useMemo(() => extractTOC(markdown), [markdown]);

  useEffect(() => {
    document.body.classList.add('redesign-on');
    const tid = setTimeout(() => setShowNav(true), 200);
    return () => {
      document.body.classList.remove('redesign-on');
      clearTimeout(tid);
    };
  }, []);

  // Reading progress bar
  useEffect(() => {
    const onScroll = () => {
      const el = articleRef.current;
      if (!el) return;
      const { top, height } = el.getBoundingClientRect();
      const scrolled = Math.max(0, -top);
      const total = height - window.innerHeight;
      setProgress(total > 0 ? Math.min(100, (scrolled / total) * 100) : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // TOC scroll-spy via IntersectionObserver
  useEffect(() => {
    if (toc.length < 3) return;
    const headings = Array.from(
      articleRef.current?.querySelectorAll('h2[id], h3[id]') ?? []
    ) as HTMLElement[];
    if (!headings.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActiveId(e.target.id);
        }
      },
      { rootMargin: '-15% 0px -70% 0px' }
    );
    headings.forEach((h) => io.observe(h));
    return () => io.disconnect();
  }, [toc]);

  const mdComponents: import('react-markdown').Components = {
    h2: ({ children, ...props }) => {
      const id = slugId(String(children));
      return <h2 id={id} {...props}>{children}</h2>;
    },
    h3: ({ children, ...props }) => {
      const id = slugId(String(children));
      return <h3 id={id} {...props}>{children}</h3>;
    },
    img: ({ src, alt }) => (
      <span className="blog-img-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt ?? ''} loading="lazy" />
        {alt && <span className="blog-img-caption">{alt}</span>}
      </span>
    ),
  };

  return (
    <>
      <div className="read-progress" aria-hidden="true" style={{ width: `${progress}%` }} />
      {showNav && <TopNav locale={locale} onLocale={() => {}} t={i18n} />}
      <div className="variant-stage is-in">
        <div className="miku-backdrop"></div>
        <div className="wrap blog-layout">
          {toc.length >= 3 && (
            <aside className="blog-toc" aria-label={locale === 'zh' ? '目录' : 'Table of contents'}>
              <p className="blog-toc__label">{locale === 'zh' ? '目录' : 'Contents'}</p>
              <nav>
                {toc.map((h) => (
                  <a
                    key={h.id}
                    href={`#${h.id}`}
                    className={[
                      'blog-toc__link',
                      h.level === 3 ? 'blog-toc__link--sub' : '',
                      activeId === h.id ? 'is-active' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    {h.text}
                  </a>
                ))}
              </nav>
            </aside>
          )}
          <article ref={articleRef} className="blog-article">
            <Link href={home} className="blog-back" data-magnet>← {locale === 'zh' ? '首页' : 'home'}</Link>
            <div className="blog-article__meta">
              <time>{date}</time>
              <span>·</span>
              <span>{readTime} {locale === 'zh' ? '分钟阅读' : 'min read'}</span>
            </div>
            <h1 className="blog-article__title">{title}</h1>
            {excerpt && <p className="blog-article__excerpt">{excerpt}</p>}
            <div className="blog-article__body">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                {markdown}
              </ReactMarkdown>
            </div>
            <footer className="blog-article__foot">
              <Link href={home} className="btn btn--ripple btn--solid btn--arrow" data-magnet>
                {locale === 'zh' ? '首页' : 'home'}
              </Link>
            </footer>
          </article>
        </div>
      </div>
      <Footer t={i18n} />
    </>
  );
}
