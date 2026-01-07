# Complete Database Setup Guide

**⚠️ IMPORTANT: Run these steps in order once Supabase is back up and running.**

## Prerequisites

1. **Wait for Supabase Support** to resolve the database lock issue
2. **Verify Database is Accessible**: Run `SELECT 1;` in SQL Editor to confirm
3. **Backup First** (if possible): Export any existing data before proceeding

---

## Step 1: Clean Up Broken Tables (If They Exist)

If the `icepulse_locations` or `icepulse_games` tables exist but are broken/locked:

```sql
-- Drop existing policies first
DROP POLICY IF EXISTS "Org members can view games" ON icepulse_games;
DROP POLICY IF EXISTS "Org members can manage games" ON icepulse_games;
DROP POLICY IF EXISTS "Organization and coaches can view locations" ON icepulse_locations;
DROP POLICY IF EXISTS "Organization and coaches can manage locations" ON icepulse_locations;

-- Drop tables if they exist (WARNING: This deletes data!)
DROP TABLE IF EXISTS icepulse_video_recordings CASCADE;
DROP TABLE IF EXISTS icepulse_games CASCADE;
DROP TABLE IF EXISTS icepulse_locations CASCADE;
```

---

## Step 2: Create Locations Table

Run: `supabase/add_locations_table.sql`

This creates:
- `icepulse_locations` table for storing rink/arena locations
- Indexes for performance
- RLS policies for access control

**Verify:**
```sql
SELECT * FROM icepulse_locations LIMIT 1;
```

---

## Step 3: Create Games/Schedule Table

Run: `supabase/add_games_table.sql`

This creates:
- `icepulse_games` table for game schedules
- Foreign keys to organizations, teams, seasons
- Indexes for performance
- RLS policies for access control

**Verify:**
```sql
SELECT * FROM icepulse_games LIMIT 1;
```

---

## Step 4: Create Video Recordings Table

Run: `supabase/add_video_recordings_table.sql`

This creates:
- `icepulse_video_recordings` table for video metadata
- **CRITICAL**: `recording_start_timestamp` for video synchronization
- Foreign keys to games, users, teams, seasons
- Indexes for performance
- RLS policies for access control

**Verify:**
```sql
SELECT * FROM icepulse_video_recordings LIMIT 1;
```

---

## Step 5: Verify All Tables Exist

Run this query to confirm all tables are created:

```sql
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'icepulse_%'
ORDER BY table_name;
```

**Expected Tables:**
- `icepulse_profiles`
- `icepulse_organizations`
- `icepulse_teams`
- `icepulse_seasons`
- `icepulse_coaches`
- `icepulse_coach_assignments`
- `icepulse_players`
- `icepulse_player_assignments`
- `icepulse_jersey_history`
- `icepulse_parents`
- `icepulse_parent_player_connections`
- `icepulse_locations` ⬅️ NEW
- `icepulse_games` ⬅️ NEW
- `icepulse_video_recordings` ⬅️ NEW

---

## Step 6: Verify RLS Policies

Check that RLS is enabled and policies exist:

```sql
-- Check RLS status
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'icepulse_%'
ORDER BY tablename;

-- Check policies for new tables
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('icepulse_locations', 'icepulse_games', 'icepulse_video_recordings')
ORDER BY tablename, policyname;
```

---

## Step 7: Test Permissions

Test that RLS policies work correctly:

```sql
-- Test as authenticated user (replace with your user ID)
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'your-user-id-here';

-- Try to select from new tables
SELECT COUNT(*) FROM icepulse_locations;
SELECT COUNT(*) FROM icepulse_games;
SELECT COUNT(*) FROM icepulse_video_recordings;
```

---

## Step 8: Create Supabase Storage Bucket (For Videos)

1. Go to **Supabase Dashboard → Storage**
2. Create a new bucket named: `game-videos`
3. Set it to **Public** (or configure RLS policies)
4. Configure CORS if needed for direct uploads

**Or via SQL:**

```sql
-- Create storage bucket for videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('game-videos', 'game-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies (adjust as needed)
CREATE POLICY "Users can upload their own videos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'game-videos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anyone can view videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'game-videos');
```

---

## Step 9: Update Application Code

Once tables are created, update your application:

1. **Disable Mock Mode**: Set `VITE_USE_MOCK_DATA=false` in `.env`
2. **Restart Dev Server**: `npm run dev`
3. **Test Game Creation**: Create a test game in the Schedule tab
4. **Test Video Recording**: Record a test video and verify it saves

---

## Troubleshooting

### If Tables Already Exist

If you get "table already exists" errors:

```sql
-- Check what exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('icepulse_locations', 'icepulse_games', 'icepulse_video_recordings');

-- If they exist but are broken, drop and recreate
DROP TABLE IF EXISTS icepulse_video_recordings CASCADE;
DROP TABLE IF EXISTS icepulse_games CASCADE;
DROP TABLE IF EXISTS icepulse_locations CASCADE;

-- Then re-run the creation scripts
```

### If RLS Policies Conflict

If you get policy conflicts:

```sql
-- Drop all policies for the table
DROP POLICY IF EXISTS "Organization and coaches can view locations" ON icepulse_locations;
DROP POLICY IF EXISTS "Organization and coaches can manage locations" ON icepulse_locations;
DROP POLICY IF EXISTS "Org members can view games" ON icepulse_games;
DROP POLICY IF EXISTS "Org members can manage games" ON icepulse_games;
-- ... (drop all video recording policies)

-- Then re-run the table creation scripts which include policy creation
```

### If Foreign Key Constraints Fail

If foreign keys fail, check that parent tables exist:

```sql
-- Verify parent tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'icepulse_organizations',
    'icepulse_teams',
    'icepulse_seasons',
    'icepulse_profiles'
  );
```

---

## Complete SQL Script (All-in-One)

If you prefer to run everything at once, here's a combined script:

**⚠️ WARNING: This will drop existing tables if they exist!**

```sql
-- ============================================
-- COMPLETE DATABASE SETUP
-- Run this after Supabase is back up
-- ============================================

-- Step 1: Drop existing broken tables (if any)
DROP POLICY IF EXISTS "Org members can view games" ON icepulse_games;
DROP POLICY IF EXISTS "Org members can manage games" ON icepulse_games;
DROP POLICY IF EXISTS "Organization and coaches can view locations" ON icepulse_locations;
DROP POLICY IF EXISTS "Organization and coaches can manage locations" ON icepulse_locations;
DROP POLICY IF EXISTS "Organization and coaches can view videos for their games" ON icepulse_video_recordings;
DROP POLICY IF EXISTS "Players and parents can view videos for their team games" ON icepulse_video_recordings;
DROP POLICY IF EXISTS "Users can create their own video recordings" ON icepulse_video_recordings;
DROP POLICY IF EXISTS "Users can update their own video recordings" ON icepulse_video_recordings;
DROP POLICY IF EXISTS "Users can delete their own video recordings" ON icepulse_video_recordings;
DROP POLICY IF EXISTS "Organization and coaches can delete videos for their games" ON icepulse_video_recordings;

DROP TABLE IF EXISTS icepulse_video_recordings CASCADE;
DROP TABLE IF EXISTS icepulse_games CASCADE;
DROP TABLE IF EXISTS icepulse_locations CASCADE;

-- Step 2: Create Locations Table
-- (Run contents of supabase/add_locations_table.sql here)

-- Step 3: Create Games Table
-- (Run contents of supabase/add_games_table.sql here)

-- Step 4: Create Video Recordings Table
-- (Run contents of supabase/add_video_recordings_table.sql here)

-- Step 5: Verify
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('icepulse_locations', 'icepulse_games', 'icepulse_video_recordings')
ORDER BY table_name;
```

---

## Checklist

- [ ] Supabase database is accessible (can run `SELECT 1;`)
- [ ] Locations table created and verified
- [ ] Games table created and verified
- [ ] Video recordings table created and verified
- [ ] All RLS policies created
- [ ] Storage bucket created for videos
- [ ] Application mock mode disabled
- [ ] Test game creation works
- [ ] Test video recording works
- [ ] Test video viewing works

---

## Need Help?

If you encounter issues:

1. **Check Supabase Logs**: Dashboard → Logs → Postgres Logs
2. **Verify RLS**: Make sure Row Level Security is enabled
3. **Check Permissions**: Verify your user has the right role
4. **Test Queries**: Run simple SELECT queries to verify access

---

**Last Updated**: After video recording feature implementation
**Status**: Ready to run once database is accessible
