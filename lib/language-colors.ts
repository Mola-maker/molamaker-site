export const LANGUAGE_COLORS: Record<string, string> = {
  Python: '#3572A5',
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Shell: '#89e051',
  'C++': '#f34b7d',
  C: '#555555',
  Rust: '#dea584',
  Go: '#00ADD8',
  Java: '#b07219',
  Ruby: '#701516',
  Kotlin: '#A97BFF',
  Swift: '#F05138',
  Dart: '#00B4AB',
  Lua: '#000080',
  Makefile: '#427819',
  Dockerfile: '#384d54',
  Roff: '#ecdebe',
};

export function languageColor(lang: string | null): string {
  return (lang && LANGUAGE_COLORS[lang]) || 'var(--ink-soft)';
}
