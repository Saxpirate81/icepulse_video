-- Step 1: Drop existing policies (safe to run multiple times)
-- Run this first to clean up any conflicting policies

DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Org members can view locations" ON icepulse_locations;
  DROP POLICY IF EXISTS "Org members can manage locations" ON icepulse_locations;
  DROP POLICY IF EXISTS "Org members can view games" ON icepulse_games;
  DROP POLICY IF EXISTS "Org members can manage games" ON icepulse_games;
  
  RAISE NOTICE 'Policies dropped successfully';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error dropping policies: %', SQLERRM;
END $$;

-- Verify policies are dropped
SELECT 
  'Policies Status' as status,
  schemaname,
  tablename,
  policyname
FROM pg_policies 
WHERE tablename IN ('icepulse_locations', 'icepulse_games');
