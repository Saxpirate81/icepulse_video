# Emergency Database Fix Guide

## Problem
- Even read-only queries are timing out
- Schemas broke when adding location/games tables
- Database appears to be locked or in a bad state

## Solution Steps

### Option 1: Via Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard → Database → Tables**
2. **Manually delete the problematic tables:**
   - Look for `icepulse_locations` - if it exists, click the 3 dots → Delete table
   - Look for `icepulse_games` - if it exists, click the 3 dots → Delete table
3. **Then run:** `supabase/recreate_tables_clean.sql`

### Option 2: Via SQL (If Dashboard Works)

**Step 1: Kill stuck queries**
- File: `supabase/kill_stuck_queries.sql`
- This terminates any blocking queries
- Run this first

**Step 2: Drop problematic tables**
- File: `supabase/emergency_drop_tables.sql`
- **WARNING:** This will delete all data in these tables
- Only run if you're okay losing any data in `icepulse_locations` and `icepulse_games`

**Step 3: Recreate tables cleanly**
- File: `supabase/recreate_tables_clean.sql`
- This creates the tables step-by-step
- Adds foreign keys one at a time to avoid timeouts

**Step 4: Add policies**
- File: `supabase/fix_schema_step5_create_policies.sql`
- Add RLS policies after tables are created

### Option 3: Contact Supabase Support

If nothing works:
1. Go to Supabase Dashboard
2. Check the "Logs" section for Postgres errors
3. Contact Supabase support with:
   - Your project URL
   - The error message
   - That you're getting timeouts on all queries

## What Likely Happened

When we created the location/games tables, something went wrong:
- Tables might have been partially created
- Foreign key constraints might be blocking
- There might be a deadlock or stuck transaction
- RLS policies might be in a bad state

## Prevention

After fixing:
- Always create tables WITHOUT foreign keys first
- Add foreign keys separately
- Add indexes separately
- Add policies last
- Test each step before moving to the next
