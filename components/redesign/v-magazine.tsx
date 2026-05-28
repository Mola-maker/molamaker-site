'use client';

// Variant B: Magazine Folio — ported from v-magazine.jsx.

import { useEffect, useRef } from 'react';
import type { I18nBlock, Locale, Post } from './data';
import { molaData } from './data';
import { HoverText, useReveal } from './atoms';

type Props = { t: I18nBlock; locale: Locale; posts?: Post[] };

export function VMagazine({ t, locale, posts }: Props) {
  // Fall back to bundled posts when the live list is missing OR empty —
  // downstream code dereferences posts[0], which would crash on an empty array.
  const d = { ...molaData, posts: posts && posts.length ? posts : molaData.posts };
  const h1Ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => h1Ref.current?.classList.add('is-in'));
  }, []);
  useReveal(locale);

  const today = new Date();
  const issue = `Vol. III · ${today.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })}`;
  const featured = d.posts[0];
  const works = [
    {
      label: 'astrbot',
      glyph: 'A',
      title: locale === 'zh' ? '为人而设计的插件 API' : 'Plugin APIs designed for humans',
      body:
        locale === 'zh'
          ? '一个插件 API 也是一种界面。把它当 UI 来设计之后，一切都变简单了。'
          : 'A plugin API is a UI. Treating it like one made everything easier — for users and for me.',
      tags: ['typescript', 'astrbot', 'tooling'],
    },
    {
      label: 'cuda',
      glyph: 'K',
      title: locale === 'zh' ? '把内核重写六遍' : 'Rewriting a CUDA kernel six times',
      body:
        locale === 'zh'
          ? 'bank conflicts、占用率，以及看到 SM 利用率终于过 80% 的小小欢喜。'
          : 'Bank conflicts, occupancy, and finally seeing SM utilization climb past 80%.',
      tags: ['cuda', 'gpu', 'systems'],
    },
    {
      label: 'gstack',
      glyph: 'g',
      title: locale === 'zh' ? '一个极小的椭圆曲线沙盒' : 'A tiny grokking stack for ECC',
      body:
        locale === 'zh'
          ? '用来研究、复现，以及偶尔向陌生人解释为什么椭圆曲线是这样工作的。'
          : 'For studying, reproducing, and occasionally explaining to strangers why ECC works.',
      tags: ['rust', 'crypto', 'sandbox'],
    },
  ];

  return (
    <div className="v-mag">
      <div className="masthead">
        <div className="masthead__l">No. 0042 · {issue}</div>
        <div className="masthead__c">— molamaker, an occasional folio —</div>
        <div className="masthead__r">
          {locale === 'zh' ? '在' : 'from'} {locale === 'zh' ? d.status.locationCn : d.status.location}
        </div>
      </div>
      <div className="wrap" id="top">
        <section className="folio has-backdrop">
          <div className="miku-backdrop"></div>
          <div className="folio__num">
            <span>№{42}</span>
            <span className="num-rule"></span>
            <span className="num-tag">{locale === 'zh' ? '本期' : 'This issue'}</span>
          </div>
          <h1 className="folio__h1" ref={h1Ref}>
            <HoverText text={t.h1[0] + ' '} mode="wave" />
            <em>
              <HoverText text={t.h1[1]} mode="wave" />
            </em>
            <HoverText text={' ' + t.h1.slice(2).join(' ')} mode="wave" />
          </h1>
          <p className="folio__body reveal">
            {t.lead}{' '}
            {locale === 'zh'
              ? '这一期我们谈谈 GPU 内核、agent 编排，以及一支古旧的钢笔。'
              : 'This issue: a kernel rewrite, a guide to agent orchestration, and one stubborn old fountain pen.'}
          </p>
          <aside className="folio__sidenote reveal">
            <h5>In this issue</h5>
            <ul>
              <li><span className="k">Feature</span><span className="v">{featured.tag}</span></li>
              <li><span className="k">Works</span><span className="v">{works.length}</span></li>
              <li><span className="k">Notes</span><span className="v">{d.posts.length}</span></li>
              <li><span className="k">Pages</span><span className="v">42 pp.</span></li>
              <li><span className="k">Edition</span><span className="v">paper-warm</span></li>
            </ul>
          </aside>
        </section>
      </div>

      <div className="wrap reveal" id="sec-2">
        <section className="feature">
          <div className="feature__rail">
            Feature · {featured.tag} · {featured.readTime} min
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 18 }}>
              {locale === 'zh' ? '本期特稿' : "This week's feature"}
            </div>
            <h2 className="feature__title">
              {locale === 'zh' ? (
                <>
                  <HoverText text="不失常地" mode="wave" />
                  <em>
                    <HoverText text=" 编排 " mode="wave" />
                  </em>
                  <HoverText text="多个智能体" mode="wave" />
                </>
              ) : (
                <>
                  <HoverText text="Orchestrating " mode="wave" />
                  <em>
                    <HoverText text="agents" mode="wave" />
                  </em>
                  <HoverText text=" without losing your mind" mode="wave" />
                </>
              )}
            </h2>
            <p className="feature__lead">{featured.excerpt}</p>
            <div className="feature__pull">
              {locale === 'zh'
                ? '"工具不是越多越好 —— 是越对越好。"'
                : '"More tools doesn’t mean a better agent. The right ones do."'}
            </div>
            <a className="feature__cta" href="#sec-3"
               onClick={(e) => { e.preventDefault(); document.querySelector('#sec-3')?.scrollIntoView({ behavior: 'smooth' }); }}>
              {locale === 'zh' ? '继续阅读' : 'Read the feature'}
            </a>
          </div>
          <div className="feature__meta">
            <div className="row"><span className="k">Filed</span><span className="v">{featured.date}</span></div>
            <div className="row"><span className="k">Read</span><span className="v">{featured.readTime} min</span></div>
            <div className="row"><span className="k">Section</span><span className="v">{featured.tag}</span></div>
            <div className="row"><span className="k">Pages</span><span className="v">12–17</span></div>
            <div className="row"><span className="k">Mood</span><span className="v">cautious</span></div>
            <div className="row"><span className="k">Tea</span><span className="v">jasmine, hot</span></div>
          </div>
        </section>
      </div>

      <div className="wrap reveal" id="sec-3">
        <section className="index-table">
          <div className="sec-rule">
            <span>
              § {locale === 'zh' ? '目录' : 'Index'} · {t.writing}
            </span>
            <span className="sec-rule__rule"></span>
            <span>
              {d.posts.length} {locale === 'zh' ? '篇' : 'entries'}
            </span>
          </div>
          <div className="index-table__head">
            <span>№</span>
            <span>{locale === 'zh' ? '日期' : 'Date'}</span>
            <span>{locale === 'zh' ? '标题' : 'Title'}</span>
            <span>{locale === 'zh' ? '摘要' : 'Note'}</span>
            <span>{locale === 'zh' ? '阅读' : 'Read'}</span>
          </div>
          {d.posts.map((p, i) => (
            <a key={p.slug} className="index-table__row" href={`/${locale}/blog/${p.slug}`} data-magnet>
              <span className="index-table__no">№ {String(i + 1).padStart(2, '0')}</span>
              <span className="index-table__date">{p.date}</span>
              <span className="index-table__title">{p.title}</span>
              <span className="index-table__excerpt">{p.excerpt}</span>
              <span className="index-table__meta">{p.readTime}′</span>
            </a>
          ))}
        </section>
      </div>

      <div className="wrap reveal" id="sec-4">
        <section className="work-spread">
          <div className="sec-rule">
            <span>§ {locale === 'zh' ? '作品集' : 'Selected work'}</span>
            <span className="sec-rule__rule"></span>
            <span>
              {works.length} {locale === 'zh' ? '件' : 'pieces'}
            </span>
          </div>
          {works.map((w, i) => (
            <article key={i} className="work-card reveal">
              <div className="work-card__art">
                <div className="pill">{w.label}</div>
                <div className="glyph">{w.glyph}</div>
              </div>
              <div>
                <div className="work-card__num">
                  № 0{i + 1} / 0{works.length}
                </div>
                <h3 className="work-card__title">{w.title}</h3>
                <p className="work-card__body">{w.body}</p>
                <div className="work-card__tags">
                  {w.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
