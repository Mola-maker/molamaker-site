-- Composite index for blog listing: filter on published, sort by published_at.
create index if not exists idx_posts_published_published_at
  on posts (published, published_at desc);

-- RLS write policy for pages table.
-- The lib/data/pages.ts updatePage function upserts via the server client;
-- this policy allows authenticated users to write.
create policy "owner can write pages" on pages for all
  to authenticated
  using (true)
  with check (true);
