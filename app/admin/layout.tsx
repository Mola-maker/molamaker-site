import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SignOutButton } from './sign-out';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.email !== process.env.OWNER_EMAIL) {
    redirect('/login');
  }

  return (
    <>
      <nav className="admin-nav">
        <div className="admin-nav-inner">
          <div className="admin-nav-links">
            <Link href="/admin">Posts</Link>
            <Link href="/admin/new">New Post</Link>
            <span style={{ color: 'var(--ink-soft)', fontSize: 12, marginLeft: 8 }}>
              {user.email}
            </span>
          </div>
          <SignOutButton />
        </div>
      </nav>
      <main>{children}</main>
    </>
  );
}
