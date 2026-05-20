/*
  Suspense fallback skeletons.
  Uses design tokens from globals.css and the pre-existing skPulse animation.
*/

import type { CSSProperties } from 'react';

/* ---------- shared primitives ---------- */

function Bar({
  w,
  h = 16,
  mt = 0,
  style,
}: {
  w: number | string;
  h?: number;
  mt?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        width: typeof w === 'number' ? w : w,
        height: h,
        marginTop: mt,
        borderRadius: 3,
        background: 'var(--rule)',
        animation: 'skPulse 2s infinite',
        ...style,
      }}
    />
  );
}

/* ---------- Hero skeleton ---------- */

export function HeroSkeleton() {
  return (
    <section className="hero" id="top" aria-hidden="true">
      {/* label */}
      <Bar w={180} h={11} />

      {/* heading — 3 lines */}
      <div style={{ marginTop: 24 }}>
        <Bar w="90%" h={68} mt={0} />
        <Bar w="72%" h={68} mt={12} />
        <Bar w="55%" h={68} mt={12} />
      </div>

      {/* lead / subtitle — 2 lines */}
      <div style={{ marginTop: 36 }}>
        <Bar w="100%" h={19} mt={0} style={{ maxWidth: '58ch' }} />
        <Bar w="70%" h={19} mt={10} style={{ maxWidth: '58ch' }} />
      </div>

      {/* meta bar */}
      <div
        style={{
          display: 'flex',
          gap: 24,
          flexWrap: 'wrap',
          marginTop: 40,
          paddingTop: 28,
          borderTop: '1px dashed var(--rule)',
        }}
      >
        <Bar w={120} h={12} />
        <Bar w={100} h={12} />
        <Bar w={140} h={12} />
        <Bar w={130} h={12} />
      </div>
    </section>
  );
}

/* ---------- Writing skeleton ---------- */

export function WritingSkeleton() {
  return (
    <section id="writing" aria-hidden="true">
      {/* label */}
      <Bar w={120} h={11} />

      {/* section heading */}
      <div style={{ marginTop: 20 }}>
        <Bar w={260} h={34} mt={0} />
      </div>

      {/* post rows */}
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            display: 'grid',
            gridTemplateColumns: '100px 1fr auto',
            gap: 32,
            padding: '24px 0',
            borderBottom: '1px solid var(--rule)',
            alignItems: 'baseline',
          }}
        >
          <Bar w={60} h={12} />
          <Bar
            w={40 + i * 20 + '%'}
            h={20}
            style={{ maxWidth: 360 }}
          />
          <Bar w={90} h={11} />
        </div>
      ))}
    </section>
  );
}

/* ---------- Guestbook skeleton ---------- */

export function GuestbookSkeleton() {
  return (
    <section id="guestbook" aria-hidden="true">
      {/* label */}
      <Bar w={130} h={11} />

      {/* heading line */}
      <div style={{ marginTop: 20 }}>
        <Bar w={320} h={34} mt={0} />
      </div>

      {/* subtitle */}
      <div style={{ marginTop: 36 }}>
        <Bar w="90%" h={19} mt={0} style={{ maxWidth: '58ch' }} />
      </div>

      {/* form placeholder */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginTop: 36,
          marginBottom: 28,
          flexWrap: 'wrap',
        }}
      >
        <Bar w={180} h={44} />
        <Bar w="auto" h={44} style={{ flex: 1, minWidth: 200 }} />
        <Bar w={78} h={44} />
      </div>

      {/* entry placeholders */}
      {[1, 2].map((i) => (
        <div
          key={i}
          style={{
            padding: '18px 0',
            borderBottom: '1px dashed var(--rule)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 6,
            }}
          >
            <Bar w={80 + i * 20} h={13} />
            <Bar w={50} h={11} />
          </div>
          <Bar w={60 + i * 25 + '%'} h={15} mt={10} />
        </div>
      ))}
    </section>
  );
}
