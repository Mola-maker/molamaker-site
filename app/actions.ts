'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function signGuestbook(formData: FormData) {
  const name = String(formData.get('name') || 'anon').trim().slice(0, 40) || 'anon';
  const message = String(formData.get('message') || '').trim().slice(0, 240);
  if (!message) return { error: 'Message is required.' };

  const supabase = await createClient();
  const { error } = await supabase.from('guestbook').insert({ name, message });
  if (error) return { error: error.message };

  revalidatePath('/');
  return { ok: true };
}

export async function sendContact(formData: FormData) {
  const name    = String(formData.get('name')    || '').trim().slice(0, 80);
  const email   = String(formData.get('email')   || '').trim().slice(0, 200);
  const subject = String(formData.get('subject') || '').trim().slice(0, 200);
  const message = String(formData.get('message') || '').trim();
  if (!message) return { error: 'Message is required.' };

  const supabase = await createClient();
  const { error } = await supabase.from('contacts').insert({
    name: name || null,
    email: email || null,
    subject: subject || null,
    message
  });
  if (error) return { error: error.message };

  return { ok: true };
}
