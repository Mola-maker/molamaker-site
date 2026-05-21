'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function SignOutButton() {
  const router = useRouter();

  return (
    <button
      onClick={async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push('/');
        router.refresh();
      }}
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        color: 'var(--ink-soft)',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
      }}
    >
      Sign Out
    </button>
  );
}
