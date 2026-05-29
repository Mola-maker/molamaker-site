'use client';

// Variant F: Notebook — handwritten journal aesthetic.
// Grid paper background, ink-serif fonts, red margin rule, stamped dates.

import { useEffect, useRef } from 'react';
import type { I18nBlock, Locale, Post, Guest } from './data';
import { molaData } from './data';
import { useReveal } from './atoms';

type Props = { t: I18nBlock; locale: Locale; posts?: Post[]; guestbook?: Guest[] };

const TAG_GLYPHS: Record<string, string> = {
  systems: '⊕', cuda: '⟁', tooling: '⚙', notes: '✎', tinkering: '⌨',
  agents: '◈', gpu: '▪', rust: '◆', crypto: '⬡',
};

function stampDate(iso: string, locale: Locale) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function EntryRow({ post, index, locale }: { post: Post; index: number; locale: Locale }) {
  const glyph = TAG_GLYPHS[post.tag] ?? '·';
  return (
    <a
      href={`/${locale}/blog/${post.slug}`}
      className="nb-entry reveal"
      data-index={String(index + 1).padStart(2, '0')}
    >
      <div className="nb-entry__margin">
        <span className="nb-entry__num">{String(index + 1).padStart(2, '0')}</span>
        <span className="nb-entry__glyph">{glyph}</span>
        <span className="nb-entry__date">{stampDate(post.date, locale)}</span>
      </div>
      <div className="nb-entry__body">
        <div className="nb-entry__tag">{post.tag}</div>
        <h3 className="nb-entry__title">{post.title}</h3>
        <p className="nb-entry__excerpt">{post.excerpt}</p>
        <div className="nb-entry__footer">
          <span className="nb-entry__read">{post.readTime} min read</span>
          <span className="nb-entry__arrow">→</span>
        </div>
      </div>
    </a>
  );
}

function NowDoodle({ locale }: { locale: Locale }) {
  const d = molaData;
  const np = d.nowPlaying;
  return (
    <aside className="nb-doodle reveal">
      <div className="nb-doodle__label">
        {locale === 'zh' ? '正在播放' : 'now playing'}
      </div>
      <div className="nb-doodle__vinyl">
        <span className="nb-doodle__disc">◎</span>
      </div>
      <div className="nb-doodle__track">{np.title}</div>
      <div className="nb-doodle__artist">{np.artist}</div>
      <hr className="nb-doodle__rule" />
      <div className="nb-doodle__status">
        <span className="nb-doodle__key">{locale === 'zh' ? '位置' : 'desk'}</span>
        <span className="nb-doodle__val">{locale === 'zh' ? d.status.locationCn : d.status.location}</span>
      </div>
      <div className="nb-doodle__status">
        <span className="nb-doodle__key">{locale === 'zh' ? '学习中' : 'learning'}</span>
        <span className="nb-doodle__val">{d.status.learning}</span>
      </div>
    </aside>
  );
}

function GuestInk({ guest, locale }: { guest: Guest; locale: Locale }) {
  void locale;
  return (
    <div className="nb-ink reveal">
      <span className="nb-ink__name">{guest.name}</span>
      <span className="nb-ink__sep"> — </span>
      <span className="nb-ink__msg">{guest.message}</span>
      <span className="nb-ink__time">{guest.t}</span>
    </div>
  );
}

export function VNotebook({ t, locale, posts, guestbook }: Props) {
  const d = {
    ...molaData,
    posts: posts && posts.length ? posts : molaData.posts,
    guestbook: guestbook && guestbook.length ? guestbook : molaData.guestbook,
  };

  const headRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    requestAnimationFrame(() => headRef.current?.classList.add('is-in'));
  }, []);
  useReveal(locale);

  const today = new Date();
  const todayStr = today.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="v-notebook">
      {/* Ruled paper background rendered via CSS */}
      <div className="nb-paper" aria-hidden />

      <div className="nb-wrap">
        {/* Cover / header */}
        <header className="nb-cover">
          <div className="nb-cover__margin">
            <span className="nb-cover__vol">№ 06</span>
            <div className="nb-cover__line" />
          </div>
          <div className="nb-cover__body">
            <div className="nb-cover__eyebrow">{t.eyebrow}</div>
            <h1 className="nb-h1" ref={headRef}>
              {locale === 'zh' ? (
                <>
                  <span className="nb-h1__plain">{t.h1[0]}</span>
                  <em className="nb-h1__em">{t.h1[1]}</em>
                  <span className="nb-h1__plain">{t.h1.slice(2).join('')}</span>
                </>
              ) : (
                <>
                  <span className="nb-h1__plain">{t.h1[0]} </span>
                  <em className="nb-h1__em">{t.h1[1]}</em>
                  <span className="nb-h1__plain">{' ' + t.h1.slice(2).join(' ')}</span>
                </>
              )}
            </h1>
            <p className="nb-lead">{t.lead}</p>
            <div className="nb-stamp">
              <span className="nb-stamp__date">{todayStr}</span>
              <span className="nb-stamp__sep"> · </span>
              <span className="nb-stamp__loc">
                {locale === 'zh' ? d.status.locationCn : d.status.location}
              </span>
            </div>
          </div>
          <NowDoodle locale={locale} />
        </header>

        {/* Divider */}
        <div className="nb-section-rule reveal">
          <span className="nb-section-rule__label">
            {locale === 'zh' ? '§ 近期文章' : '§ Recent writing'}
          </span>
        </div>

        {/* Journal entries */}
        <div className="nb-entries">
          {d.posts.map((p, i) => (
            <EntryRow key={p.slug} post={p} index={i} locale={locale} />
          ))}
        </div>

        {/* Guestbook ink */}
        {d.guestbook.length > 0 && (
          <>
            <div className="nb-section-rule reveal">
              <span className="nb-section-rule__label">
                {locale === 'zh' ? '§ 留言簿' : '§ Guestbook'}
              </span>
            </div>
            <div className="nb-inks">
              {d.guestbook.slice(0, 4).map((g, i) => (
                <GuestInk key={i} guest={g} locale={locale} />
              ))}
              <a href={`/${locale}/guestbook`} className="nb-ink-more reveal">
                {locale === 'zh' ? '查看全部留言 →' : 'See all entries →'}
              </a>
            </div>
          </>
        )}

        {/* Footer note */}
        <div className="nb-colophon reveal">
          <span>
            {locale === 'zh'
              ? '这本笔记本使用 Next.js 和 Supabase 构建，以 molamaker 的名义在数字纸张上书写。'
              : 'This notebook is hand-assembled in Next.js and Supabase, written on digital paper under the name molamaker.'}
          </span>
        </div>
      </div>
    </div>
  );
}
