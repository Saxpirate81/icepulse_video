# 🔓 Fixing Supabase Database Locks

## What Happened (Simple Explanation)

Your database has **"locks"** - think of them as stuck queries that are blocking everything else. It's like someone left a door locked and now nobody can get through.

Supabase support found multiple locks in your database logs. This is why:
- All queries timeout
- Dashboard can't load tables
- Everything is stuck

## Quick Fix (Do This First)

### Step 1: Kill the Locks

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Open the file: `supabase/kill_all_locks.sql`
3. **Copy the entire contents**
4. **Paste into SQL Editor**
5. Click **"Run"**

This will:
- Show you what's locked
- Kill all stuck queries
- Verify locks are cleared

### Step 2: Try Dashboard Again

After running the script:
1. Wait 10-15 seconds
2. Go to **Database** → **Tables**
3. It should work now!

### Step 3: Clean Up the Broken Tables

Once the dashboard works:

1. **Manually delete the problematic tables:**
   - Go to **Database** → **Tables**
   - Find `icepulse_locations` - click 3 dots → **Delete table**
   - Find `icepulse_games` - click 3 dots → **Delete table**

2. **Then recreate them:**
   - Run: `supabase/recreate_tables_clean.sql` in SQL Editor

## What Supabase Support Meant (Simple Terms)

They mentioned several things - here's what they mean:

### 1. "Multiple locks in Postgres logs"
- **Translation**: Stuck queries blocking everything
- **Fix**: Kill them (use the script above)

### 2. "Long-running queries"
- **Translation**: Queries that take too long and block others
- **Fix**: Kill them, then optimize later

### 3. "Disk IO resources"
- **Translation**: Database is working too hard
- **Fix**: Kill locks first, then we can optimize

### 4. "pg_stat_statements"
- **Translation**: Tool to see which queries are slow
- **Fix**: Not needed right now - just kill the locks

## Step-by-Step Fix

### Option 1: Use the Kill Script (Easiest)

1. **Supabase Dashboard** → **SQL Editor**
2. Run `supabase/kill_all_locks.sql`
3. Wait 15 seconds
4. Try dashboard again
5. If it works, delete and recreate the tables

### Option 2: Use Supabase CLI (If you have it)

```bash
supabase inspect db locks
```

This shows you what's locked. Then you can kill them manually.

### Option 3: Wait It Out

Sometimes locks clear automatically after 15-30 minutes. But the script is faster.

## After Locks Are Cleared

Once the dashboard works:

1. **Delete the broken tables:**
   - `icepulse_locations`
   - `icepulse_games`

2. **Recreate them cleanly:**
   - Run `supabase/recreate_tables_clean.sql`

3. **Test:**
   - Try adding a game
   - Try searching locations
   - Everything should work!

## Prevention

To avoid this in the future:

1. **Always use `IF NOT EXISTS`** in CREATE statements
2. **Drop policies before creating them**
3. **Test migrations one at a time**
4. **Don't run multiple migrations simultaneously**

## Still Stuck?

If the kill script doesn't work:

1. **Wait 30 minutes** - locks sometimes clear automatically
2. **Contact Supabase support again** - tell them the kill script didn't work
3. **Check Supabase Dashboard** → **Logs** → **Postgres Logs** for errors

---

**TL;DR**: Run `kill_all_locks.sql` in SQL Editor, wait 15 seconds, then try the dashboard again. If it works, delete and recreate the broken tables.
