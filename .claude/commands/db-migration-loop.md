# Database Migration Loop

Create, validate, and apply a Supabase migration end-to-end.

## Usage
```
/db-migration-loop <what needs to change in the schema>
```

## What This Loop Does

1. **Analyze** — Review existing migrations and schema to understand current state
2. **Write migration** — Create a correctly named migration file
3. **Validate** — Check for common RLS/security issues before pushing
4. **Push** — Apply to local Supabase (or flag if not running)
5. **Regenerate types** — Run `npm run db:types` if schema changed
6. **Verify build** — Confirm TypeScript still compiles with new types

## Instructions

### Step 1: Analyze existing schema
- Read all files in `supabase/migrations/` to understand current tables, policies, indexes
- Identify the highest existing timestamp (format: YYYYMMDDHHMMSS)
- Your new migration filename must use a timestamp AFTER the highest existing one

### Step 2: Write the migration file
Filename format: `supabase/migrations/{TIMESTAMP}_{description}.sql`

Migration checklist:
- [ ] Every new table has `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- [ ] Every table has explicit policies for SELECT, INSERT, UPDATE, DELETE
- [ ] Public read tables use `FOR SELECT USING (true)`
- [ ] User-specific tables use `auth.uid() = user_id` pattern
- [ ] Indexes added for foreign keys and frequently filtered columns
- [ ] No `SECURITY DEFINER` functions unless absolutely necessary
- [ ] Include a rollback comment at the top: `-- Rollback: DROP TABLE ...`

### Step 3: Security review
Check the migration for:
- Tables missing RLS enable
- Policies that expose data beyond intended scope
- RPC/functions that bypass RLS accidentally
- Missing indexes that would cause full-table scans under RLS

If any blocker found, fix before proceeding.

### Step 4: Apply migration
```bash
supabase db push
```
If supabase CLI is not running locally, output the SQL for manual application and stop.

### Step 5: Regenerate TypeScript types (if schema changed)
```bash
npm run db:types
```

### Step 6: Verify TypeScript still compiles
```bash
npx tsc --noEmit 2>&1
```
Fix any type errors caused by the schema change.

### Step 7: Signal completion
Output:
```
DB_MIGRATION_LOOP_COMPLETE
```
With a summary: what table/policy/index was added and why.

## Existing Migration Patterns to Follow
- `20260521000001_rate_limits.sql` — rate limiting RPC pattern
- `20260520000000_auth_and_drafts.sql` — auth/user table pattern
- `20260521000002_indexes_rls.sql` — index + RLS combo pattern
