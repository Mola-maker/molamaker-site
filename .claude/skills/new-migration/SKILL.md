---
name: new-migration
description: Scaffold a new Supabase migration file with correct timestamp naming, RLS checklist, and reminders
---

The user wants to create a new Supabase migration. They will describe what needs to change.

## Steps

1. List all files in `supabase/migrations/` and find the highest timestamp (format YYYYMMDDHHMMSS).
   New migration timestamp must be strictly higher. Use today's date + an incrementing suffix if multiple migrations exist for today.

2. Ask for the migration name/description if the user didn't provide one (kebab-case, e.g. `add_notifications_table`).

3. Create `supabase/migrations/{TIMESTAMP}_{name}.sql` with this structure:

```sql
-- Migration: {description}
-- Created: {date}
-- Rollback: {brief rollback instructions}

-- === YOUR SQL HERE ===
```

4. After writing the SQL, run through this checklist and flag any violations:

**RLS Checklist:**
- [ ] `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on every new table
- [ ] Explicit policies for every access pattern (SELECT, INSERT, UPDATE, DELETE)
- [ ] Public read → `USING (true)`
- [ ] User-scoped access → `USING (auth.uid() = user_id)`
- [ ] `SECURITY DEFINER` functions justified and annotated (see rate_limits pattern)
- [ ] Indexes on FK columns and frequently filtered columns
- [ ] No unintentional full-table scan under RLS

5. Remind the user to run:
```bash
supabase db push          # apply to local/linked project
npm run db:types          # regenerate TypeScript types if schema changed
npx tsc --noEmit          # verify types still compile
```

## Migration Patterns in This Project

Reference these for consistency:
- `20260520000000_auth_and_drafts.sql` — auth/user table + auth-scoped RLS
- `20260521000001_rate_limits.sql` — `SECURITY DEFINER` RPC function pattern
- `20260521000002_indexes_rls.sql` — combined indexes + RLS policies
- `20260525000000_stream_tables.sql` — latest pattern, check this first
