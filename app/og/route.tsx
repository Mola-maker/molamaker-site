import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get('title') ?? 'molamaker — portfolio & journal';
  const date = searchParams.get('date');

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200, height: 630,
          background: '#F5F1EB',
          display: 'flex', flexDirection: 'column',
          justifyContent: 'center',
          padding: 80,
          fontFamily: 'Georgia, serif',
        }}
      >
        <div style={{ fontSize: 64, fontWeight: 400, color: '#2A2520', lineHeight: 1.1, marginBottom: 24, maxWidth: 1000 }}>
          {title}
        </div>
        {date && (
          <div style={{ fontSize: 28, color: '#8B816E', marginBottom: 12 }}>{date}</div>
        )}
        <div style={{ fontSize: 28, color: '#C96442', fontStyle: 'italic' }}>molamaker</div>
        <div style={{ position: 'absolute', bottom: 60, left: 80, width: 40, height: 2, background: '#C96442' }} />
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
