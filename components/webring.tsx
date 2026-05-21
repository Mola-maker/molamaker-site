export default function Webring() {
  // TODO: fill in actual webring URLs after joining
  const name = 'molamaker';
  const prev = '#';
  const next = '#';

  return (
    <div className="webring">
      <a href={prev} className="webring-link" title="Previous site">← prev</a>
      <span className="webring-name">{name}</span>
      <a href={next} className="webring-link" title="Next site">next →</a>
    </div>
  );
}
