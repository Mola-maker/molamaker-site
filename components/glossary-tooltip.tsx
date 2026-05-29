'use client';

// Glossary tooltip — highlights known technical terms in blog post body text
// and shows a definition card on hover. Terms come from /api/glossary.
// Uses a MutationObserver to handle dynamically rendered markdown content.

import { useEffect, useRef, useState } from 'react';

type TooltipState = {
  term: string;
  definition: string;
  x: number;
  y: number;
} | null;

export function GlossaryTooltip({ containerSelector }: { containerSelector: string }) {
  const glossaryRef = useRef<Record<string, string>>({});
  const [tooltip, setTooltip] = useState<TooltipState>(null);

  // Load glossary once
  useEffect(() => {
    fetch('/api/glossary')
      .then((r) => r.json())
      .then((j: { data?: Record<string, string> }) => {
        if (j.data) glossaryRef.current = j.data;
        highlight();
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const highlight = () => {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    const terms = Object.keys(glossaryRef.current);
    if (terms.length === 0) return;

    // Walk text nodes and wrap matching terms
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const matches: { node: Text; term: string; start: number; end: number }[] = [];

    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      // Skip already-processed nodes and script/style
      const parent = node.parentElement;
      if (!parent) continue;
      if (parent.dataset.glossary || ['SCRIPT', 'STYLE', 'CODE', 'PRE'].includes(parent.tagName)) continue;

      const text = node.nodeValue ?? '';
      // Sort by length descending to match "bank conflict" before "conflict"
      const sorted = [...terms].sort((a, b) => b.length - a.length);
      for (const term of sorted) {
        const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) {
          matches.push({ node, term, start: m.index, end: m.index + m[0].length });
        }
      }
    }

    // Apply wrappers from last to first (so indices stay valid)
    const processed = new Set<Text>();
    for (const { node: n, term, start, end } of matches.reverse()) {
      if (processed.has(n)) continue; // skip after split
      processed.add(n);

      const before = n.nodeValue!.slice(0, start);
      const matched = n.nodeValue!.slice(start, end);
      const after = n.nodeValue!.slice(end);

      const span = document.createElement('span');
      span.dataset.glossary = term;
      span.textContent = matched;
      span.style.cssText =
        'border-bottom: 1px dotted var(--accent, #C96442); cursor: help; color: inherit;';
      span.addEventListener('mouseenter', (e) => {
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        setTooltip({
          term,
          definition: glossaryRef.current[term] ?? '',
          x: rect.left + rect.width / 2,
          y: rect.top,
        });
      });
      span.addEventListener('mouseleave', () => setTooltip(null));

      const parent = n.parentNode!;
      if (before) parent.insertBefore(document.createTextNode(before), n);
      parent.insertBefore(span, n);
      if (after) n.nodeValue = after;
      else parent.removeChild(n);
    }
  };

  // Re-run when container content changes (async markdown render)
  useEffect(() => {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    const obs = new MutationObserver(() => {
      if (Object.keys(glossaryRef.current).length > 0) highlight();
    });
    obs.observe(container, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [containerSelector]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!tooltip) return null;

  return (
    <div
      role="tooltip"
      style={{
        position: 'fixed',
        left: Math.min(tooltip.x, window.innerWidth - 280),
        top: tooltip.y - 8,
        transform: 'translateY(-100%)',
        zIndex: 9999,
        maxWidth: 270,
        background: 'var(--bg-ink, #1A1612)',
        color: 'var(--bg-elev, #FAF7F1)',
        borderRadius: 6,
        padding: '10px 14px',
        pointerEvents: 'none',
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
      }}
    >
      <div style={{
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: 9.5,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'var(--accent-soft, #E5B79E)',
        marginBottom: 5,
      }}>
        {tooltip.term}
      </div>
      <div style={{
        fontSize: 12.5,
        lineHeight: 1.6,
        fontFamily: 'var(--font-sans, sans-serif)',
      }}>
        {tooltip.definition}
      </div>
    </div>
  );
}
