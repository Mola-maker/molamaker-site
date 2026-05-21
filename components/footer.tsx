import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import SupportButton from '@/components/support-button';
import Webring from '@/components/webring';

export default async function Footer() {
  const t = await getTranslations('footer');

  return (
    <footer>
      <Webring />
      <div className="footer-sitemap">
        <div className="footer-group">
          <span className="footer-group-title">{t('read')}</span>
          <Link href="/blog">Blog</Link>
          <Link href="/work">Work</Link>
          <Link href="/uses">Uses</Link>
        </div>
        <div className="footer-group">
          <span className="footer-group-title">{t('about')}</span>
          <Link href="/about">About</Link>
          <Link href="/now">Now</Link>
        </div>
        <div className="footer-group">
          <span className="footer-group-title">{t('talk')}</span>
          <Link href="/guestbook">Guestbook</Link>
          <Link href="/contact">Contact</Link>
        </div>
      </div>
      <div className="footer-bottom">
        © {new Date().getFullYear()} molamaker · {t('madeWith')}{' '}
        <span className="accent">♥</span> {t('andTooMuchCoffee')} ·{' '}
        <a href="https://github.com/Mola-maker" target="_blank" rel="noopener noreferrer">github</a>{' '}
        · <SupportButton size="sm" />{' '}
        · <span className="accent">●</span> {t('live')}
      </div>
    </footer>
  );
}
