import Link from 'next/link';
import SupportButton from '@/components/support-button';

export default function Footer() {
  return (
    <footer>
      <div className="footer-sitemap">
        <div className="footer-group">
          <span className="footer-group-title">Read</span>
          <Link href="/blog">Blog</Link>
          <Link href="/work">Work</Link>
          <Link href="/uses">Uses</Link>
        </div>
        <div className="footer-group">
          <span className="footer-group-title">About</span>
          <Link href="/about">About</Link>
          <Link href="/now">Now</Link>
        </div>
        <div className="footer-group">
          <span className="footer-group-title">Talk</span>
          <Link href="/guestbook">Guestbook</Link>
          <Link href="/contact">Contact</Link>
        </div>
      </div>
      <div className="footer-bottom">
        © {new Date().getFullYear()} molamaker · made with{' '}
        <span className="accent">♥</span> and too much coffee ·{' '}
        <a href="https://github.com/Mola-maker" target="_blank" rel="noopener noreferrer">github</a>{' '}
        · <SupportButton size="sm" />{' '}
        · <span className="accent">●</span> live
      </div>
    </footer>
  );
}
