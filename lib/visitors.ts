// Active-visitor aggregation. Pure + unit-testable: turns newest-first
// page_views rows into one dot per DISTINCT visitor (session_id), so the
// "active visitors" count reflects unique people, not raw page-view events.

export interface PageViewRow {
  path: string | null;
  created_at: string;
  session_id?: string | null;
}

export interface VisitorDot {
  page: string;
  age_s: number;
}

/**
 * Collapse page-view rows (must be ordered newest-first) to one dot per
 * distinct visitor. The first row seen for a session_id is that visitor's most
 * recent page. Legacy rows with no session_id each count once (they predate the
 * fingerprint and can't be deduplicated).
 */
export function dedupeActiveVisitors(
  rows: PageViewRow[],
  now: number = Date.now(),
  max = 80,
): VisitorDot[] {
  const seen = new Set<string>();
  const out: VisitorDot[] = [];
  for (const row of rows) {
    const sid = row.session_id;
    if (sid) {
      if (seen.has(sid)) continue;
      seen.add(sid);
    }
    out.push({
      page: String(row.path ?? '/').slice(0, 40),
      age_s: Math.floor((now - new Date(row.created_at).getTime()) / 1000),
    });
    if (out.length >= max) break;
  }
  return out;
}
