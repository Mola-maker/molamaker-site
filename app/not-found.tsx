import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '70vh',
        padding: '80px 32px',
        textAlign: 'center',
        background: 'var(--bg)',
        backgroundImage:
          'radial-gradient(circle at 1px 1px, rgba(60,50,30,0.04) 1px, transparent 0)',
        backgroundSize: '24px 24px',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
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
        404
      </div>

      <h1
        style={{
          fontFamily: 'var(--font-serif)',
          fontWeight: 400,
          fontSize: 'clamp(40px, 7vw, 76px)',
          lineHeight: 1.05,
          letterSpacing: '-0.02em',
          marginBottom: 24,
          color: 'var(--ink)',
        }}
      >
        This page doesn&apos;t{' '}
        <em style={{ fontStyle: 'italic', color: 'var(--accent)', fontWeight: 300 }}>
          exist
        </em>
      </h1>

      <p
        style={{
          fontSize: 17,
          lineHeight: 1.6,
          color: 'var(--ink-2)',
          maxWidth: '42ch',
          marginBottom: 40,
        }}
      >
        The thing you were looking for was never here, has moved, or was never written.
      </p>

      <Link
        href="/"
        className="notfound-link"
        style={{
          fontSize: 14,
          fontWeight: 500,
          padding: '12px 24px',
          background: 'var(--ink)',
          color: 'var(--bg)',
          textDecoration: 'none',
          borderRadius: 3,
          transition: 'background .2s, transform .1s',
          display: 'inline-block',
        }}
      >
        Back home
      </Link>
    </div>
  );
}
