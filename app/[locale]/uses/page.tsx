import type { Metadata } from 'next';
import NavWrapper from '@/components/nav-wrapper';
import Footer from '@/components/footer';

export const metadata: Metadata = { title: 'Uses — molamaker' };

function UseSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        color: 'var(--ink-soft)',
        marginBottom: 12,
        fontWeight: 500
      }}>
        {title}
      </h3>
      <ul style={{ listStyle: 'none' }}>
        {items.map((item) => (
          <li key={item} style={{
            padding: '10px 0',
            borderBottom: '1px dotted var(--rule)',
            color: 'var(--ink-2)',
            fontSize: 15
          }}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function UsesPage() {
  return (
    <>
      <NavWrapper />
      <main>
        <section>
          <div className="label">Uses</div>
          <h2>Tools, hardware, and software.</h2>

          <div style={{ maxWidth: '52ch' }}>
            <UseSection
              title="Editor + Terminal"
              items={[
                'VS Code with a lean set of extensions',
                'Windows Terminal (yes, really)',
                'PowerShell for scripting, WSL when I need a real shell'
              ]}
            />
            <UseSection
              title="Languages"
              items={[
                'TypeScript — daily driver for web and agents',
                'Python — data, scripting, and quick experiments',
                'CUDA C++ — learning the metal',
                'Rust — for when correctness matters more than speed of writing'
              ]}
            />
            <UseSection
              title="Hardware"
              items={[
                'ThinkPad — reliable, upgradeable, and the keyboard is unmatched',
                'A Linux phone I probably shouldn’t daily-drive but do'
              ]}
            />
            <UseSection
              title="Apps"
              items={[
                'Firefox — with containers for separating work and life',
                'Obsidian — for notes, logs, and half-formed ideas',
                'Spotify — lo-fi streams on repeat',
                'Discord — where the communities are'
              ]}
            />
            <UseSection
              title="Books on the desk"
              items={[
                'Programming Massively Parallel Processors, 4th ed.',
                'Something by Tufte — probably Envisioning Information'
              ]}
            />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
