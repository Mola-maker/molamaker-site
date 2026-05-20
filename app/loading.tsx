export default function Loading() {
  return (
    <div
      style={{
        maxWidth: 1100,
        margin: '0 auto',
        padding: '0 32px',
      }}
    >
      {/* Hero skeleton */}
      <section
        style={{
          padding: '100px 0 80px',
          borderBottom: '1px solid var(--rule)',
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
          <SkeletonPill w={140} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          <SkeletonPill w="min(520px, 70%)" h="clamp(40px, 7vw, 76px)" />
          <SkeletonPill w="min(380px, 50%)" h="clamp(40px, 7vw, 76px)" />
        </div>

        <SkeletonPill w={480} h={19} opacity={0.7} />
      </section>

      {/* Content rows */}
      <section style={{ padding: '80px 0', borderBottom: '1px solid var(--rule)' }}>
        <SkeletonPill w={260} h={28} style={{ marginBottom: 40 }} />
        <div style={{ display: 'grid', gap: 18 }}>
          <SkeletonPill w="100%" h={16} opacity={0.8} />
          <SkeletonPill w="92%" h={16} opacity={0.8} />
          <SkeletonPill w="96%" h={16} opacity={0.8} />
          <SkeletonPill w="85%" h={16} opacity={0.8} />
          <SkeletonPill w="60%" h={16} opacity={0.6} />
        </div>
      </section>

      {/* Another section skeleton */}
      <section style={{ padding: '80px 0', borderBottom: '1px solid var(--rule)' }}>
        <SkeletonPill w={220} h={28} style={{ marginBottom: 40 }} />
        <div style={{ display: 'grid', gap: 16 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 16,
                padding: '14px 0',
                borderBottom: '1px dashed var(--rule)',
              }}
            >
              <SkeletonPill w={80} h={14} />
              <SkeletonPill w={300} h={14} opacity={0.8} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SkeletonPill({
  w,
  h = 16,
  opacity = 1,
  style,
}: {
  w: number | string;
  h?: number | string;
  opacity?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        width: typeof w === 'number' ? w : w,
        height: typeof h === 'number' ? h : h,
        background: 'var(--bg-deep)',
        borderRadius: 3,
        animation: 'skPulse 1.8s ease-in-out infinite',
        opacity,
        ...style,
      }}
    />
  );
}
