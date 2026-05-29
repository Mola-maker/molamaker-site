import { ImageResponse } from 'next/og';

export const runtime = 'edge';

// Tag → gradient pair [from, to]
const TAG_GRADIENTS: Record<string, [string, string]> = {
  systems:   ['#C96442', '#A04E30'],
  cuda:      ['#5E6B8C', '#3A4A6B'],
  tooling:   ['#3E7C5F', '#2A5A42'],
  notes:     ['#8A5A3B', '#6A3E23'],
  tinkering: ['#6B5E8C', '#4A3E6B'],
  agents:    ['#A04E30', '#7A3218'],
  gpu:       ['#4A7A8C', '#2A5A6B'],
  rust:      ['#7C5E3E', '#5A3E22'],
  crypto:    ['#5C7C3E', '#3C5A22'],
};

// Fallback gradient for unknown tags
const DEFAULT_GRADIENT: [string, string] = ['#C96442', '#A04E30'];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title    = searchParams.get('title')    ?? 'molamaker — portfolio & journal';
  const tag      = searchParams.get('tag')      ?? '';
  const readTime = searchParams.get('readTime') ?? '';
  const date     = searchParams.get('date')     ?? '';
  const excerpt  = searchParams.get('excerpt')  ?? '';

  const [gradFrom, gradTo] = TAG_GRADIENTS[tag] ?? DEFAULT_GRADIENT;

  // Truncate long text
  const displayTitle   = title.length   > 60  ? title.slice(0, 57)   + '…' : title;
  const displayExcerpt = excerpt.length > 120 ? excerpt.slice(0, 117) + '…' : excerpt;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200, height: 630,
          background: '#F5F1EB',
          display: 'flex',
          fontFamily: 'Georgia, serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Left accent bar */}
        <div style={{
          position: 'absolute',
          left: 0, top: 0, bottom: 0,
          width: 8,
          background: `linear-gradient(to bottom, ${gradFrom}, ${gradTo})`,
        }} />

        {/* Top tag stripe */}
        {tag && (
          <div style={{
            position: 'absolute',
            top: 0, left: 8, right: 0,
            height: 4,
            background: `linear-gradient(to right, ${gradFrom}44, transparent)`,
          }} />
        )}

        {/* Decorative grid lines */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `repeating-linear-gradient(to bottom, transparent, transparent 39px, rgba(100,90,70,0.06) 39px, rgba(100,90,70,0.06) 40px)`,
        }} />

        {/* Main content */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 80px 64px 96px',
          flex: 1,
        }}>
          {/* Top row: tag + date */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            {tag && (
              <div style={{
                fontSize: 16,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: gradFrom,
                fontFamily: 'monospace',
                border: `1px solid ${gradFrom}66`,
                padding: '4px 12px',
                borderRadius: 2,
              }}>
                {tag}
              </div>
            )}
            {readTime && (
              <div style={{
                fontSize: 16,
                fontFamily: 'monospace',
                color: '#8B816E',
                letterSpacing: '0.08em',
              }}>
                {readTime} min read
              </div>
            )}
            {date && (
              <div style={{
                fontSize: 16,
                fontFamily: 'monospace',
                color: '#B5AB94',
                letterSpacing: '0.06em',
              }}>
                {date}
              </div>
            )}
          </div>

          {/* Title */}
          <div style={{
            fontSize: title.length > 40 ? 56 : 68,
            fontWeight: 400,
            color: '#2A2520',
            lineHeight: 1.12,
            letterSpacing: '-0.02em',
          }}>
            {displayTitle}
          </div>

          {/* Excerpt */}
          {displayExcerpt && (
            <div style={{
              fontSize: 22,
              color: '#6A5E4A',
              lineHeight: 1.55,
              maxWidth: 860,
              fontStyle: 'italic',
            }}>
              {displayExcerpt}
            </div>
          )}

          {/* Bottom brand row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 32, height: 2,
              background: `linear-gradient(to right, ${gradFrom}, ${gradTo})`,
            }} />
            <div style={{
              fontSize: 22,
              color: gradFrom,
              fontStyle: 'italic',
              letterSpacing: '0.04em',
            }}>
              molamaker
            </div>
            <div style={{
              fontSize: 14,
              fontFamily: 'monospace',
              color: '#B5AB94',
              letterSpacing: '0.06em',
            }}>
              portfolio &amp; journal
            </div>
          </div>
        </div>

        {/* Right accent column */}
        <div style={{
          width: 180,
          background: `linear-gradient(to bottom right, ${gradFrom}18, ${gradTo}08)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
        }}>
          <div style={{
            fontSize: 72,
            color: `${gradFrom}44`,
            fontStyle: 'italic',
            lineHeight: 1,
          }}>
            M
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
