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
