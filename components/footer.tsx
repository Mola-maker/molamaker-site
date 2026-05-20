export default function Footer() {
  return (
    <footer>
      © {new Date().getFullYear()} molamaker · made with{' '}
      <span className="accent">♥</span> and too much coffee ·{' '}
      <a href="https://github.com/Mola-maker" target="_blank" rel="noopener noreferrer">github</a>{' '}
      · <span className="accent">●</span> live
    </footer>
  );
}
