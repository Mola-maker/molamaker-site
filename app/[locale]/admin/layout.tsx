import { requireAdmin } from '@/lib/auth';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { SignOutButton } from './sign-out';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();
  const t = await getTranslations('nav');

  return (
    <>
      <nav className="admin-nav">
        <div className="admin-nav-inner">
          <div className="admin-nav-links">
            <Link href="/admin">{t('admin')}</Link>
            <Link href="/admin/new">+</Link>
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
