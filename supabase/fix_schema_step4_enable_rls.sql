-- Step 4: Enable RLS (safe to run multiple times)
-- Run this after Step 3

-- Enable RLS
ALTER TABLE icepulse_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE icepulse_games ENABLE ROW LEVEL SECURITY;

-- Verify RLS is enabled
SELECT 
  'RLS Status' as status,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('icepulse_locations', 'icepulse_games')
ORDER BY tablename;
