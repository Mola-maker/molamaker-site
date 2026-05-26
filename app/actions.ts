'use server';

import { revalidatePath } from 'next/cache';
import { guestbookSchema, contactSchema } from '@/lib/validation';
import { checkRate, RATE_GUESTBOOK, RATE_CONTACT } from '@/lib/rate-limit';
import { isDuplicate } from '@/lib/dedup';
import { insertEntry } from '@/lib/data/guestbook';
import { insertContact } from '@/lib/data/contacts';
import { clientIp } from '@/lib/client-ip';

/**
 * Server Action: sign the guestbook.
 *
 * FormData fields:
 * - name  — 1-40 chars, trimmed, sanitized
 * - message — 1-240 chars, trimmed, safe-text only, sanitized
 *
 * Return: ApiResult
 * - { ok: true } on success (revalidates / ISR cache)
 * - { error: string } on validation / rate-limit / DB failure
 *
 * Rate limit: per-IP token bucket (see RATE_GUESTBOOK).
 * Scope: Server Component / Server Action only.
 */
export async function signGuestbook(formData: FormData) {
  const parsed = guestbookSchema.safeParse({
    name: formData.get('name'),
    message: formData.get('message'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const ip = await clientIp();
  const rate = await checkRate(`gb:${ip}`, RATE_GUESTBOOK.limit, RATE_GUESTBOOK.windowMs);
  if (!rate.allowed) {
    return { error: 'Too many requests. Try again later.' };
  }

  if (isDuplicate(`gb:${ip}`, parsed.data.message)) {
    return { error: 'Duplicate message.' };
  }

  const result = await insertEntry(parsed.data.name, parsed.data.message);
  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath('/', 'layout');
  return { ok: true };
}

/**
 * Server Action: send a contact message.
 *
 * FormData fields:
 * - name    — 0-80 chars, trimmed, sanitized (optional)
 * - email   — valid email or empty string, max 200 chars
 * - subject — 0-200 chars, trimmed, sanitized
 * - message — 1-5000 chars, trimmed, safe-text only, sanitized
 *
 * Return: ApiResult
 * - { ok: true } on success
 * - { error: string } on validation / rate-limit / DB failure
 *
 * Rate limit: per-IP token bucket (see RATE_CONTACT).
 * Scope: Server Component / Server Action only.
 */
export async function sendContact(formData: FormData) {
  const parsed = contactSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    subject: formData.get('subject'),
    message: formData.get('message'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const ip = await clientIp();
  const rate = await checkRate(`ct:${ip}`, RATE_CONTACT.limit, RATE_CONTACT.windowMs);
  if (!rate.allowed) {
    return { error: 'Too many messages. Wait a moment.' };
  }

  if (isDuplicate(`ct:${ip}`, parsed.data.message)) {
    return { error: 'Duplicate message.' };
  }

  const result = await insertContact(parsed.data);
  if (!result.ok) {
    return { error: result.error };
  }

  // No revalidatePath — contact messages have no public listing page
  return { ok: true };
}
