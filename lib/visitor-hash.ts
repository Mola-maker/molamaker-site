import { createHash } from 'node:crypto';

// A privacy-preserving, daily-rotating visitor fingerprint used to count
// DISTINCT active visitors without storing any PII. It is a one-way hash of
// IP + User-Agent + the calendar day (+ an optional pepper); the raw IP is
// never persisted or returned. The daily rotation means the same person gets a
// new id each day, so the fingerprint cannot be used for long-term tracking.

const PEPPER = process.env.WORKPLACE_SESSION_SECRET ?? 'mola-visitor';

export function visitorHash(ip: string, ua: string, now: Date = new Date()): string {
  const day = now.toISOString().slice(0, 10); // YYYY-MM-DD
  return createHash('sha256')
    .update(`${ip}|${ua}|${day}|${PEPPER}`)
    .digest('hex')
    .slice(0, 16);
}
