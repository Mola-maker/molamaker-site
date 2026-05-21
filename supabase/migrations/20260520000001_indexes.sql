-- Performance indexes (add after table creation).

-- Speeds up chronological post listings and the RSS feed ordering
create index if not exists idx_posts_published_at on posts(published_at desc);

-- Explicit slug index for lookup clarity (the unique constraint already
-- creates one, but an explicit index documents intent)
create index if not exists idx_posts_slug on posts(slug);

-- Speeds up guestbook page which lists entries newest-first
create index if not exists idx_guestbook_created_at on guestbook(created_at desc);

-- Speeds up per-page view count queries (e.g., /blog/post-slug analytics)
create index if not exists idx_page_views_path on page_views(path);

-- Speeds up time-range queries on page view analytics
create index if not exists idx_page_views_created_at on page_views(created_at desc);
