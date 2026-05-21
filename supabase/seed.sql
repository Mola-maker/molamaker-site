-- Seed posts (run once, safe to re-run with ON CONFLICT).

insert into posts (slug, title, published_at, read_time, view_count, excerpt, content, published) values
  ('kernel-rewrite', 'Why I rewrote my first CUDA kernel three times', '2026-01-15', 8, 124, 'The first version was correct. The third was fast. Here is what changed between them — and what the profiler taught me along the way.', '...', true),
  ('agent-orchestration', 'Notes on agent orchestration that actually works', '2026-02-01', 11, 89, 'Five specialists, one shared context, zero hallucinated citations (mostly).', '...', true),
  ('rotational-dynamics', 'A small love letter to rotational dynamics', '2026-02-14', 4, 56, 'On gyroscopic precession and why it still surprises me.', '...', true),
  ('astrbot-review', 'Path traversal in the wild: an AstrBot review', '2026-03-01', 8, 210, 'Reading code with paranoia mode on.', '...', true),
  ('termux-os', 'Termux is a tiny operating system, actually', '2026-03-10', 5, 167, 'Rootless Linux in your pocket.', '...', true)
on conflict (slug) do nothing;

-- Seed pages (Now, Uses).
insert into pages (slug, content) values
  ('now', 'I''m currently deep in CUDA kernel programming — writing fast GPU code for matrix operations and learning about warp-level primitives. When I''m not optimizing memory access patterns, I''m building a multi-agent CMS that coordinates LLM agents through structured prompts. My reading stack is PMPP (4th ed.) for the GPU work, and occasional physics papers on rotational dynamics. Music: mostly lo-fi and ambient — it helps with the late-night coding sessions.'),
  ('uses', '## Editor + Terminal\n\n- VS Code with Vim keybindings\n- Windows Terminal + PowerShell\n- Neovim for quick edits\n\n## Languages\n\n- TypeScript / JavaScript\n- Python (NumPy, PyTorch, AstrBot)\n- CUDA C++\n- Rust (learning)\n\n## Hardware\n\n- ThinkPad T-series\n- Some Linux phone (testing rootless environments)\n- Raspberry Pi 4 (homelab)\n\n## Apps\n\n- Firefox Developer Edition\n- Obsidian for notes\n- Spotify for focus music\n- Discord for communities\n\n## Books on the desk\n\n- Programming Massively Parallel Processors (4th ed.)\n- Envisioning Information — Edward Tufte\n- The C Programming Language — K&R')
on conflict (slug) do nothing;
