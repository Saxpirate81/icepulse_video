# Schema Troubleshooting Guide

If Supabase can't pull up schemas, here's how to fix it:

## Quick Fix (If getting timeout errors)

**IMPORTANT: If you're getting timeouts, start here:**

**Step 0: Check database state first**
- File: `supabase/check_database_state.sql`
- Run this to see what exists and what's blocking
- This is read-only, so it won't timeout

**Option 1: Minimal fix (if check shows tables don't exist)**
- File: `supabase/fix_schema_minimal.sql`
- Creates tables WITHOUT foreign keys (avoids timeout)
- Then run `add_foreign_keys_later.sql` separately

**Option 2: Simple fix (if minimal works)**
- File: `supabase/fix_schema_simple.sql`
- This creates tables with foreign keys
- Run this if minimal fix works

**Option 2: Run step-by-step (Recommended if simple fix works)**
Run these scripts in order:
1. `fix_schema_step1_drop_policies.sql` - Clean up old policies
2. `fix_schema_step2_create_tables.sql` - Create tables
3. `fix_schema_step3_add_constraints.sql` - Add constraints and indexes
4. `fix_schema_step4_enable_rls.sql` - Enable RLS
5. `fix_schema_step5_create_policies.sql` - Create policies

**Option 3: Full fix (if no timeout issues)**
- File: `supabase/fix_schema_issues.sql`
- This does everything in one script

## What Might Have Happened

The issue could be:
1. **Policy conflicts** - If policies were created multiple times
2. **Table creation errors** - If tables partially created
3. **Constraint conflicts** - If unique constraints conflict
4. **RLS blocking** - If RLS is blocking schema queries

## Step-by-Step Fix

### Option 1: Run the Fix Script (Recommended)

1. Go to Supabase Dashboard → SQL Editor
2. Open `supabase/fix_schema_issues.sql`
3. Copy and paste the entire contents
4. Click "Run"
5. Check for any error messages

### Option 2: Manual Cleanup

If the fix script doesn't work, try this:

```sql
-- 1. Drop policies
DROP POLICY IF EXISTS "Org members can view locations" ON icepulse_locations;
DROP POLICY IF EXISTS "Org members can manage locations" ON icepulse_locations;
DROP POLICY IF EXISTS "Org members can view games" ON icepulse_games;
DROP POLICY IF EXISTS "Org members can manage games" ON icepulse_games;

-- 2. Drop tables (WARNING: This will delete all data!)
-- Only do this if you're sure you want to start fresh
-- DROP TABLE IF EXISTS icepulse_locations CASCADE;
-- DROP TABLE IF EXISTS icepulse_games CASCADE;

-- 3. Then run the original migration scripts again
```

### Option 3: Check for Errors

Run this to see what's wrong:

```sql
-- Check for tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'icepulse_%'
ORDER BY table_name;

-- Check for policies
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('icepulse_locations', 'icepulse_games');

-- Check for errors in recent queries
-- (Check Supabase Dashboard → Logs → Postgres Logs)
```

## Prevention

To avoid this in the future:
1. Always run migrations one at a time
2. Check for errors after each migration
3. Use `IF NOT EXISTS` clauses in CREATE statements
4. Drop policies before recreating them

## Still Having Issues?

If Supabase still can't show schemas:
1. Check the Postgres logs in Supabase Dashboard
2. Try refreshing the Supabase dashboard
3. Check if there are any connection issues
4. Verify your database is not paused or in maintenance mode
