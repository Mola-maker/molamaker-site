import Image from 'next/image';
import { SITE_CONFIG, SECTION_IDS } from '@/lib/constants';

export default function Nav() {
  return (
    <nav className="top">
      <div className="nav-inner">
        <div className="brand">
          <Image
            className="brand-mini"
            src={SITE_CONFIG.avatarUrl}
            alt="mola"
            width={28}
            height={28}
            unoptimized
          />
          molamaker<span className="dot">.</span>
        </div>
        <div className="nav-links">
          <a href={`#${SECTION_IDS.about}`}>About</a>
          <a href={`#${SECTION_IDS.work}`}>Work</a>
          <a href={`#${SECTION_IDS.writing}`}>Writing</a>
          <a href={`#${SECTION_IDS.guestbook}`}>Guestbook</a>
          <a href={`#${SECTION_IDS.contact}`}>Contact</a>
        </div>
      </div>
    </nav>
  );
}
