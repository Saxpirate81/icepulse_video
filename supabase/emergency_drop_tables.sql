-- Emergency: Drop the problematic tables
-- ONLY RUN THIS IF YOU'RE OKAY WITH LOSING DATA IN THESE TABLES
-- This will forcefully drop icepulse_locations and icepulse_games

-- Disable RLS temporarily
ALTER TABLE IF EXISTS icepulse_locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS icepulse_games DISABLE ROW LEVEL SECURITY;

-- Drop all policies first
DROP POLICY IF EXISTS "Org members can view locations" ON icepulse_locations;
DROP POLICY IF EXISTS "Org members can manage locations" ON icepulse_locations;
DROP POLICY IF EXISTS "Org members can view games" ON icepulse_games;
DROP POLICY IF EXISTS "Org members can manage games" ON icepulse_games;

-- Drop indexes
DROP INDEX IF EXISTS idx_icepulse_locations_organization;
DROP INDEX IF EXISTS idx_icepulse_locations_name;
DROP INDEX IF EXISTS idx_icepulse_games_organization;
DROP INDEX IF EXISTS idx_icepulse_games_team;
DROP INDEX IF EXISTS idx_icepulse_games_season;
DROP INDEX IF EXISTS idx_icepulse_games_date;
DROP INDEX IF EXISTS idx_icepulse_games_team_season;

-- Drop constraints
ALTER TABLE IF EXISTS icepulse_locations DROP CONSTRAINT IF EXISTS icepulse_locations_organization_id_fkey;
ALTER TABLE IF EXISTS icepulse_locations DROP CONSTRAINT IF EXISTS icepulse_locations_created_by_fkey;
ALTER TABLE IF EXISTS icepulse_locations DROP CONSTRAINT IF EXISTS icepulse_locations_organization_id_name_key;
ALTER TABLE IF EXISTS icepulse_games DROP CONSTRAINT IF EXISTS icepulse_games_organization_id_fkey;
ALTER TABLE IF EXISTS icepulse_games DROP CONSTRAINT IF EXISTS icepulse_games_team_id_fkey;
ALTER TABLE IF EXISTS icepulse_games DROP CONSTRAINT IF EXISTS icepulse_games_season_id_fkey;
ALTER TABLE IF EXISTS icepulse_games DROP CONSTRAINT IF EXISTS icepulse_games_created_by_fkey;

-- Finally, drop the tables
DROP TABLE IF EXISTS icepulse_locations CASCADE;
DROP TABLE IF EXISTS icepulse_games CASCADE;

-- Verify they're gone
SELECT 
  'Tables Dropped' as status,
  table_name
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name IN ('icepulse_locations', 'icepulse_games');
