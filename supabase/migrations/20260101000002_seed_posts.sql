-- Seed posts (run once, safe to re-run with ON CONFLICT).

insert into posts (slug, title, excerpt, read_time) values
  ('kernel-rewrite',      'Why I rewrote my kernel three times',              'A tale of pointer chases and warp divergence.', 6),
  ('agent-orchestration', 'Notes on agent orchestration that actually works', 'Five specialists, one shared context, zero hallucinated citations (mostly).', 11),
  ('rotational-dynamics', 'A small love letter to rotational dynamics',       'On gyroscopic precession and why it still surprises me.', 4),
  ('astrbot-review',      'Path traversal in the wild: an AstrBot review',    'Reading code with paranoia mode on.', 8),
  ('termux-os',           'Termux is a tiny operating system, actually',      'Rootless Linux in your pocket.', 5)
on conflict (slug) do nothing;
