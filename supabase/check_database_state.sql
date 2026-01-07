-- Check Database State
-- Run this first to see what's going on with your database
-- This should NOT timeout - it's just read-only queries

-- Check if tables exist
SELECT 
  'Table Status' as check_type,
  table_name,
  CASE 
    WHEN table_name IS NOT NULL THEN 'EXISTS'
    ELSE 'MISSING'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name IN ('icepulse_locations', 'icepulse_games')
ORDER BY table_name;

-- Check for any policies on these tables
SELECT 
  'Policy Status' as check_type,
  schemaname,
  tablename,
  policyname
FROM pg_policies 
WHERE tablename IN ('icepulse_locations', 'icepulse_games')
ORDER BY tablename, policyname;

-- Check for locks (this might show if something is blocking)
SELECT 
  'Lock Status' as check_type,
  locktype,
  relation::regclass as table_name,
  mode,
  granted
FROM pg_locks
WHERE relation::regclass::text IN ('icepulse_locations', 'icepulse_games')
LIMIT 10;

-- Check if required parent tables exist
SELECT 
  'Parent Tables' as check_type,
  table_name,
  CASE 
    WHEN table_name IS NOT NULL THEN 'EXISTS'
    ELSE 'MISSING - NEEDED FOR FOREIGN KEYS'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name IN ('icepulse_organizations', 'icepulse_teams', 'icepulse_seasons', 'icepulse_profiles')
ORDER BY table_name;
