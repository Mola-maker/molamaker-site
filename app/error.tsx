'use client';

import { useEffect } from 'react';

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    console.error('Page render error:', error);
  }, [error]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '80px 32px',
        textAlign: 'center',
        background: 'var(--bg)',
        color: 'var(--ink)',
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--ink-soft)',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span
          style={{
            width: 24,
            height: 1,
            background: 'var(--accent)',
            display: 'inline-block',
          }}
        />
        Error
      </div>

      <h1
        style={{
          fontFamily: "'Fraunces', serif",
          fontWeight: 400,
          fontSize: 'clamp(32px, 5vw, 56px)',
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          marginBottom: 24,
          color: 'var(--ink)',
        }}
      >
        Something went{' '}
        <em style={{ fontStyle: 'italic', color: 'var(--accent)', fontWeight: 300 }}>
          sideways
        </em>
      </h1>

      {error.message && (
        <p
          style={{
            fontSize: 15,
            lineHeight: 1.6,
            color: 'var(--ink-2)',
            maxWidth: '48ch',
            marginBottom: 36,
            padding: '12px 16px',
            background: 'var(--bg-deep)',
            border: '1px solid var(--rule)',
            borderRadius: 3,
          }}
        >
          {error.message}
        </p>
      )}

      <button
        onClick={() => reset()}
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 14,
          fontWeight: 500,
          padding: '12px 24px',
          background: 'var(--ink)',
          color: 'var(--bg)',
          border: 'none',
          borderRadius: 3,
          cursor: 'pointer',
          transition: 'background .2s, transform .1s',
        }}
        onMouseOver={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent)';
        }}
        onMouseOut={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--ink)';
        }}
        onMouseDown={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.98)';
        }}
        onMouseUp={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
        }}
      >
        Try again
      </button>
    </div>
  );
}
