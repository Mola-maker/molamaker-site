import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser, isSupporter } from '@/lib/auth';
import NavWrapper from '@/components/nav-wrapper';
import Footer from '@/components/footer';
import { Link } from '@/i18n/routing';

export const metadata: Metadata = { title: 'Resources — molamaker' };

export default async function ResourcesPage() {
  const t = await getTranslations('resources');
  const user = await getCurrentUser();
  const supporter = user ? await isSupporter(user.id) : false;

  return (
    <>
      <NavWrapper />
      <main>
        <section>
          <div className="label">{t('label')}</div>
          <h1 className="display">{t('title')}</h1>

          {!user && (
            <div style={{ maxWidth: '52ch' }}>
              <p className="lead">{t('loginPrompt')}</p>
              <p style={{ marginTop: 24 }}>
                <Link href="/login" className="send" style={{ textDecoration: 'none' }}>
                  {t('signIn')}
                </Link>
              </p>
            </div>
          )}

          {user && !supporter && (
            <div style={{ maxWidth: '52ch' }}>
              <p className="lead">{t('supporterPrompt')}</p>
              <p style={{ marginTop: 24 }}>
                <Link href="/support" className="send" style={{ textDecoration: 'none' }}>
                  {t('learnMore')}
                </Link>
              </p>
            </div>
          )}

          {supporter && (
            <div style={{ maxWidth: '52ch' }}>
              <div className="form-ok" style={{ marginBottom: 24 }}>
                {t('verified')}
              </div>
              <p className="lead">{t('comingSoon')}</p>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
