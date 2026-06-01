'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

type SearchHit = {
  kind: 'post' | 'project' | 'guest';
  slug?: string;
  title: string;
  excerpt: string;
  tag?: string;
  date?: string;
  url?: string;
};

const KIND_LABEL: Record<string, string> = {
  post: 'Post', project: 'Project', guest: 'Guest',
};
const KIND_COLOR: Record<string, string> = {
  post: '#C96442', project: '#3E7C5F', guest: '#5E6B8C',
};

export function SearchPanel({ locale }: { locale: string }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); setSearched(false); return; }
    setLoading(true);
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(q)}&locale=${locale}`);
      const j = await r.json() as { data?: SearchHit[] };
      setResults(j.data ?? []);
      setSearched(true);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [locale]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(q), 300);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (timerRef.current) clearTimeout(timerRef.current);
      search(query);
    }
  };

  const mono: React.CSSProperties = { fontFamily: 'var(--font-mono, monospace)' };

  return (
    <section>
      <div className="label">Search</div>
      <h2 style={{ marginBottom: 24 }}>Find anything.</h2>

      {/* Search box */}
      <div style={{
        display: 'flex',
        gap: 10,
        marginBottom: 40,
        maxWidth: 640,
      }}>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKey}
          placeholder={locale === 'zh' ? '搜索文章、留言…' : 'Search posts, guests…'}
          style={{
            flex: 1,
            padding: '12px 16px',
            background: 'var(--bg-elev)',
            border: '1px solid var(--rule)',
            borderRadius: 4,
            ...mono,
            fontSize: 14,
            color: 'var(--ink)',
            outline: 'none',
          }}
          autoComplete="off"
        />
        <button
          onClick={() => search(query)}
          disabled={loading}
          style={{
            padding: '12px 20px',
            background: 'var(--accent)',
            color: 'var(--bg-elev)',
            borderRadius: 4,
            ...mono,
            fontSize: 12,
            letterSpacing: '0.1em',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? '…' : '↵'}
        </button>
      </div>

      {/* Results */}
      {searched && results.length === 0 && (
        <p style={{ ...mono, fontSize: 13, color: 'var(--ink-soft)' }}>
          {locale === 'zh' ? '没有找到相关内容。' : 'Nothing found. Try different keywords.'}
        </p>
      )}

      {results.length > 0 && (
        <>
          <p style={{ ...mono, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 20 }}>
            {results.length} result{results.length !== 1 ? 's' : ''}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxWidth: 760 }}>
            {results.map((hit, i) => (
              <a
                key={hit.url ?? hit.slug ?? i}
                href={hit.url ?? '#'}
                style={{
                  display: 'block',
                  padding: '18px 0',
                  borderBottom: '1px dotted var(--rule)',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{
                    ...mono,
                    fontSize: 9,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: KIND_COLOR[hit.kind] ?? 'var(--accent)',
                    border: `1px solid ${KIND_COLOR[hit.kind] ?? 'var(--accent)'}44`,
                    padding: '2px 7px',
                    borderRadius: 2,
                  }}>
                    {KIND_LABEL[hit.kind] ?? hit.kind}
                  </span>
                  {hit.tag && (
                    <span style={{ ...mono, fontSize: 9, color: 'var(--ink-faint)', letterSpacing: '0.12em' }}>
                      {hit.tag}
                    </span>
                  )}
                  {hit.date && (
                    <span style={{ ...mono, fontSize: 9, color: 'var(--ink-faint)' }}>{hit.date}</span>
                  )}
                </div>
                <div style={{ fontSize: 17, color: 'var(--ink)', marginBottom: 6 }}>
                  {hit.title}
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.65 }}>
                  {hit.excerpt}
                </div>
              </a>
            ))}
          </div>
        </>
      )}

      {!searched && (
        <div style={{ ...mono, fontSize: 12, color: 'var(--ink-faint)', lineHeight: 1.9 }}>
          <div>— posts by title, tag, excerpt</div>
          <div>— guestbook entries by name or message</div>
        </div>
      )}
    </section>
  );
}
