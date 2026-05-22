'use client';

import { useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SITE_CONFIG } from '@/lib/constants';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const supabase = createClient();
    if (!supabase) {
      setError('Authentication service is not configured. Contact the site owner.');
      return;
    }
    // Use runtime origin so the redirect always points to the actual
    // deployed domain, even if NEXT_PUBLIC_SITE_URL was empty or wrong
    // at build time. Falls back to SITE_CONFIG.siteUrl during SSR.
    const siteUrl =
      typeof window !== 'undefined'
        ? window.location.origin
        : SITE_CONFIG.siteUrl;
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${siteUrl}/auth/callback` },
    });
    if (sendError) {
      setError(sendError.message);
    } else {
      setSent(true);
    }
  }

  return (
    <main>
      <div style={{ maxWidth: 420, margin: '120px auto', padding: '0 32px' }}>
        <div className="label">Admin</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, marginBottom: 32 }}>
          Sign in.
        </h1>

        {sent ? (
          <div className="form-ok">Check your email for a magic link.</div>
        ) : (
          <form className="contact-form" onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="your-email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: '100%' }}
            />
            <button className="send" type="submit">
              Send magic link
            </button>
            {error && <div className="form-err">{error}</div>}
          </form>
        )}
      </div>
    </main>
  );
}
