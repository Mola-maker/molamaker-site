# Supabase

## Backups

Supabase free tier auto-backs-up daily, retains 7 days.

Manual export:
```bash
supabase db dump --schema public > backup.sql
```

Restore:
```bash
supabase db reset && psql -f backup.sql
```

## Migrations

Apply in order:
```bash
supabase db push
```

Or run manually in Supabase SQL Editor in timestamp order.
