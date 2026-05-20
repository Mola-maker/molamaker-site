import { z } from 'zod';

const SAFE_TEXT_RE = /^[\p{L}\p{N}\s\-_.,!?@#&()'"\/:+*;=\[\]{}<>|~`$%^]+$/u;

const safeText = z
  .string()
  .regex(SAFE_TEXT_RE, 'Contains characters that are not allowed');

const sanitize = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

/**
 * Guestbook entry validation.
 *
 * - name: 1-40 chars, trimmed, HTML-sanitized
 * - message: 1-240 chars, trimmed, safe-text regex + HTML-sanitized
 */
export const guestbookSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(40, 'Name must be 40 characters or fewer')
    .transform(sanitize),
  message: z
    .string()
    .trim()
    .min(1, 'Message is required')
    .max(240, 'Message must be 240 characters or fewer')
    .pipe(safeText)
    .transform(sanitize),
});

/**
 * Contact form validation.
 *
 * - name: 0-80 chars, trimmed, HTML-sanitized (optional)
 * - email: valid email or empty (coerced to null), max 200 chars
 * - subject: 0-200 chars, trimmed, HTML-sanitized (optional)
 * - message: 1-5000 chars, trimmed, safe-text regex + HTML-sanitized
 */
export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .max(80, 'Name must be 80 characters or fewer')
    .transform(sanitize),
  email: z
    .string()
    .trim()
    .max(200, 'Email must be 200 characters or fewer')
    .email('Invalid email format')
    .or(z.literal(''))
    .transform((s) => s || null),
  subject: z
    .string()
    .trim()
    .max(200, 'Subject must be 200 characters or fewer')
    .transform(sanitize),
  message: z
    .string()
    .trim()
    .min(1, 'Message is required')
    .max(5000, 'Message must be 5000 characters or fewer')
    .pipe(safeText)
    .transform(sanitize),
});

/**
 * Page view payload validation.
 *
 * - path: 1-500 chars, must start with '/' and not contain '..'
 */
export const pageViewSchema = z.object({
  path: z
    .string()
    .min(1)
    .max(500)
    .refine((p) => p.startsWith('/') && !p.includes('..'), {
      message: 'Invalid path',
    }),
});

export type GuestbookInput = z.infer<typeof guestbookSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type PageViewInput = z.infer<typeof pageViewSchema>;
