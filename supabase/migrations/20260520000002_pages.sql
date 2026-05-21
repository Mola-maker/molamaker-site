-- pages table — editable content pages (Now, Uses, etc.).

create table if not exists pages (
  slug text primary key,
  content text not null default '',
  updated_at timestamptz default now()
);

insert into pages (slug, content) values
  ('now', 'I''m currently deep in CUDA kernel programming — writing fast GPU code for matrix operations and learning about warp-level primitives. When I''m not optimizing memory access patterns, I''m building a multi-agent CMS that coordinates LLM agents through structured prompts. My reading stack is PMPP (4th ed.) for the GPU work, and occasional physics papers on rotational dynamics. Music: mostly lo-fi and ambient — it helps with the late-night coding sessions.'),
  ('uses', '## Editor + Terminal\n\n- VS Code with Vim keybindings\n- Windows Terminal + PowerShell\n- Neovim for quick edits\n\n## Languages\n\n- TypeScript / JavaScript\n- Python (NumPy, PyTorch, AstrBot)\n- CUDA C++\n- Rust (learning)\n\n## Hardware\n\n- ThinkPad T-series\n- Some Linux phone (testing rootless environments)\n- Raspberry Pi 4 (homelab)\n\n## Apps\n\n- Firefox Developer Edition\n- Obsidian for notes\n- Spotify for focus music\n- Discord for communities\n\n## Books on the desk\n\n- Programming Massively Parallel Processors (4th ed.)\n- Envisioning Information — Edward Tufte\n- The C Programming Language — K&R')
on conflict (slug) do nothing;

alter table pages enable row level security;

drop policy if exists "read pages" on pages;
create policy "read pages" on pages for select using (true);

comment on table pages is 'Editable content pages (Now, Uses, etc.)';
comment on column pages.slug is 'URL-safe page identifier (e.g. ''now'', ''uses'')';
comment on column pages.content is 'Page body content (plain text or markdown)';
comment on column pages.updated_at is 'Last modification timestamp';
