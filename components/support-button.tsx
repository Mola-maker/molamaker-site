export default function SupportButton({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const handle = process.env.NEXT_PUBLIC_BMAC_HANDLE;
  if (!handle) return null;
  return (
    <a
      href={`https://www.buymeacoffee.com/${handle}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`coffee-btn coffee-btn-${size}`}
      aria-label="Buy me a coffee"
    >
      <span className="coffee-emoji" aria-hidden="true">☕</span>
      <span className="coffee-label">Buy me a coffee</span>
    </a>
  );
}
