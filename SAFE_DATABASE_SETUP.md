# Safe Database Setup Guide

**⚠️ IMPORTANT: Your database is showing resource warnings. Follow these steps carefully.**

## Step 1: Check Database Health First

Before running any setup scripts, check the database state:

1. **Run Diagnostic Query:**
   ```sql
   -- Check basic connectivity
   SELECT 1;
   ```

2. **Run Pre-Setup Cleanup:**
   - Open `supabase/pre_setup_cleanup.sql`
   - Run it section by section (don't run the commented-out kill commands yet)
   - Review the results to see:
     - Any stuck queries
     - Lock conflicts
     - Connection counts
     - Table sizes

## Step 2: Clean Up Stuck Queries (If Needed)

If you see stuck queries or locks in Step 1:

```sql
-- Kill long-running queries (over 5 minutes)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state != 'idle'
  AND pid != pg_backend_pid()
  AND query_start < NOW() - INTERVAL '5 minutes'
  AND query NOT LIKE '%pg_stat_activity%';
```

**⚠️ Only run this if you see problematic queries!**

## Step 3: Check Resource Usage

Go to **Supabase Dashboard → Settings → Usage** and check:
- **Database Size**: Should be reasonable
- **Active Connections**: Should be under your plan limit
- **API Requests**: Check if there's unusual activity

## Step 4: Wait if Needed

If resources are exhausted:
1. **Wait 5-10 minutes** for connections to clear
2. **Restart your dev server** to close any hanging connections
3. **Check Supabase Dashboard** for any error logs

## Step 5: Run Setup in Small Batches

Instead of running the complete script at once, run it in sections:

### Batch 1: Drop Existing Tables (if broken)
```sql
-- Only run if tables exist and are broken
DROP POLICY IF EXISTS "Org members can view games" ON icepulse_games;
DROP POLICY IF EXISTS "Org members can manage games" ON icepulse_games;
-- ... (rest of policy drops)
DROP TABLE IF EXISTS icepulse_video_recordings CASCADE;
DROP TABLE IF EXISTS icepulse_games CASCADE;
DROP TABLE IF EXISTS icepulse_locations CASCADE;
```

**Wait 30 seconds, then:**

### Batch 2: Create Locations Table
```sql
-- Run just the locations table creation from complete_setup_all_tables.sql
-- (Lines for CREATE TABLE icepulse_locations ...)
```

**Wait 30 seconds, then:**

### Batch 3: Create Games Table
```sql
-- Run just the games table creation
```

**Wait 30 seconds, then:**

### Batch 4: Create Video Recordings Table
```sql
-- Run just the video recordings table creation
```

## Step 6: Verify After Each Step

After each batch, verify it worked:

```sql
-- Check table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'icepulse_locations'; -- Change name for each check
```

## Alternative: Use Individual Scripts

Instead of the complete script, use the individual scripts one at a time:

1. `supabase/add_locations_table.sql` - Wait, verify
2. `supabase/add_games_table.sql` - Wait, verify  
3. `supabase/add_video_recordings_table.sql` - Wait, verify

This is safer and gives the database time to process each step.

## If You Get Timeout Errors

If you get connection timeout errors:

1. **Stop**: Don't keep retrying immediately
2. **Wait**: Give the database 5-10 minutes to recover
3. **Check Dashboard**: Look for error messages
4. **Try Again**: Run smaller batches
5. **Contact Support**: If it persists

## Recommended Approach

Given the resource warning, I recommend:

1. ✅ Run `pre_setup_cleanup.sql` to check state
2. ✅ Wait 5 minutes
3. ✅ Run `add_locations_table.sql` individually
4. ✅ Wait 2 minutes, verify
5. ✅ Run `add_games_table.sql` individually
6. ✅ Wait 2 minutes, verify
7. ✅ Run `add_video_recordings_table.sql` individually
8. ✅ Wait 2 minutes, verify

This slower approach is safer when resources are constrained.

## After Setup

Once all tables are created:

1. **Disable Mock Mode**: Set `VITE_USE_MOCK_DATA=false` in `.env`
2. **Restart Dev Server**: `npm run dev`
3. **Test Gradually**: 
   - Create one game
   - Record one video
   - View videos
4. **Monitor Resources**: Keep an eye on usage dashboard

---

**Remember**: Slow and steady wins the race when dealing with resource constraints!
