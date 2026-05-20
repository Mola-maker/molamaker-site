'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { guestbookSchema, contactSchema } from '@/lib/validation';
import { checkRate, RATE_GUESTBOOK, RATE_CONTACT } from '@/lib/rate-limit';

async function clientIp() {
  const h = await headers();
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    '127.0.0.1'
  );
}

export async function signGuestbook(formData: FormData) {
  const parsed = guestbookSchema.safeParse({
    name: formData.get('name'),
    message: formData.get('message'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const ip = await clientIp();
  const rate = checkRate(`gb:${ip}`, RATE_GUESTBOOK.limit, RATE_GUESTBOOK.windowMs);
  if (!rate.allowed) {
    return { error: 'Too many requests. Try again later.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('guestbook')
    .insert(parsed.data);
  if (error) {
    console.error('guestbook insert error:', error.message);
    return { error: 'Could not sign guestbook. Try again.' };
  }

  revalidatePath('/');
  return { ok: true };
}

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
  const rate = checkRate(`ct:${ip}`, RATE_CONTACT.limit, RATE_CONTACT.windowMs);
  if (!rate.allowed) {
    return { error: 'Too many messages. Wait a moment.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('contacts')
    .insert(parsed.data);
  if (error) {
    console.error('contact insert error:', error.message);
    return { error: 'Could not send message. Try again later.' };
  }

  return { ok: true };
}
