'use client';

import { useLocale } from 'next-intl';
import { routing, usePathname, useRouter } from '@/i18n/routing';

export default function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  function switchTo(next: string) {
    router.replace(pathname, { locale: next });
  }

  return (
    <span className="locale-switcher">
      {routing.locales.map((l, i) => (
        <span key={l}>
          {i > 0 && <span className="locale-sep">|</span>}
          <button
            type="button"
            className={`locale-btn${l === locale ? ' locale-active' : ''}`}
            onClick={() => switchTo(l)}
            aria-label={l === 'en' ? 'English' : '中文'}
          >
            {l === 'en' ? 'EN' : '中文'}
          </button>
        </span>
      ))}
    </span>
  );
}
