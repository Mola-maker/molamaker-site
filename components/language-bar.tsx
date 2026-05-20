import { languageColor } from '@/lib/language-colors';

export default function LanguageBar({ counts }: { counts: Record<string, number> }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  let x = 0;

  return (
    <svg width="100%" height="12" style={{ borderRadius: 4, overflow: 'hidden' }}>
      {Object.entries(counts).map(([lang, count]) => {
        const w = (count / total) * 100;
        const rect = (
          <rect
            key={lang}
            x={`${x}%`}
            width={`${w}%`}
            height="12"
            fill={languageColor(lang)}
          >
            <title>
              {lang}: {count} repos ({Math.round(w)}%)
            </title>
          </rect>
        );
        x += w;
        return rect;
      })}
    </svg>
  );
}
