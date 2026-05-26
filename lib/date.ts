export function fmtDate(iso: string, locale = 'en-US') {
  return new Date(iso).toLocaleDateString(locale, { month: 'short', day: '2-digit' });
}

export function fmtDateLong(iso: string, locale = 'en-US') {
  return new Date(iso).toLocaleDateString(locale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function fmtRelative(
  isoOrMs: string | number,
  opts?: { style?: 'dash' | 'ago' },
): string {
  const ms = typeof isoOrMs === 'string' ? new Date(isoOrMs).getTime() : isoOrMs;
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  const style = opts?.style ?? 'dash';
  const prefix = style === 'ago' ? '' : '− ';
  const suffix = style === 'ago' ? ' ago' : '';

  if (m < 1) return 'now';
  if (m < 60) return `${prefix}${m}m${suffix}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${prefix}${h}h${suffix}`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${prefix}${d}d${suffix}`;
  const mo = Math.floor(d / 30);
  if (style === 'ago' && mo >= 12) return `${Math.floor(mo / 12)}y ago`;
  return `${prefix}${mo}mo${suffix}`;
}
