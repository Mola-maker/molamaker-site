'use client';
import { useState, useEffect, useCallback } from 'react';

type Annotation = {
  id: string;
  text: string;
  note: string;
  timestamp: number;
  pathname: string;
};

export default function AnnotationSidebar() {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [note, setNote] = useState('');
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`annotations-${pathname}`);
      if (stored) setAnnotations(JSON.parse(stored));
    } catch {}
  }, [pathname]);

  const saveAnnotations = (anns: Annotation[]) => {
    setAnnotations(anns);
    try { localStorage.setItem(`annotations-${pathname}`, JSON.stringify(anns)); } catch {}
  };

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (text && text.length > 0 && text.length < 500) {
      setSelectedText(text);
      const range = sel!.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top - 10 });
    } else {
      setTooltipPos(null);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  const addAnnotation = () => {
    if (!selectedText || !note.trim()) return;
    const ann: Annotation = {
      id: Math.random().toString(36).slice(2),
      text: selectedText,
      note: note.trim(),
      timestamp: Date.now(),
      pathname,
    };
    saveAnnotations([ann, ...annotations]);
    setNote('');
    setSelectedText('');
    setTooltipPos(null);
    setShowForm(false);
  };

  const deleteAnnotation = (id: string) => {
    saveAnnotations(annotations.filter((a) => a.id !== id));
  };

  return (
    <>
      {tooltipPos && (
        <div
          style={{
            position: 'fixed',
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: 'translate(-50%, -100%)',
            zIndex: 100,
            background: 'var(--accent)',
            color: 'white',
            padding: '6px 12px',
            borderRadius: 3,
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
          onClick={() => setShowForm(true)}
        >
          + Add note
        </div>
      )}

      {showForm && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.2)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
        >
          <div style={{
            background: 'var(--bg-elev)', padding: 24, borderRadius: 6,
            maxWidth: 420, width: '90%',
            border: '1px solid var(--rule)',
          }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-soft)', marginBottom: 8 }}>SELECTED TEXT</p>
            <p style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 16, fontStyle: 'italic' }}>&ldquo;{selectedText.slice(0, 120)}{selectedText.length > 120 ? '…' : ''}&rdquo;</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Your note…"
              style={{
                width: '100%', minHeight: 80,
                fontFamily: 'var(--font-sans)', fontSize: 15,
                padding: 10, border: '1px solid var(--rule)', borderRadius: 3,
                background: 'var(--bg)', color: 'var(--ink)',
                marginBottom: 12, resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: '1px solid var(--rule)', padding: '8px 16px', borderRadius: 3, cursor: 'pointer', color: 'var(--ink-2)', fontSize: 14 }}>Cancel</button>
              <button onClick={addAnnotation} disabled={!note.trim()} className="send" style={{ fontSize: 14 }}>Save note</button>
            </div>
          </div>
        </div>
      )}

      <aside className="annotation-sidebar">
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 500, marginBottom: 20, color: 'var(--ink)' }}>
          Notes
        </div>
        {annotations.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', fontStyle: 'italic' }}>
            Select text to add notes as you read.
          </p>
        )}
        {annotations.map((a) => (
          <div key={a.id} className="annotation-card">
            <p className="annotation-text">&ldquo;{a.text.slice(0, 80)}{a.text.length > 80 ? '…' : ''}&rdquo;</p>
            <p className="annotation-note">{a.note}</p>
            <button className="annotation-delete" onClick={() => deleteAnnotation(a.id)} title="Delete">&times;</button>
          </div>
        ))}
      </aside>
    </>
  );
}
