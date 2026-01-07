-- Step 3: Add constraints and indexes (safe to run multiple times)
-- Run this after Step 2

-- Add unique constraint to locations if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'icepulse_locations_organization_id_name_key'
  ) THEN
    ALTER TABLE icepulse_locations 
    ADD CONSTRAINT icepulse_locations_organization_id_name_key 
    UNIQUE(organization_id, name);
    RAISE NOTICE 'Unique constraint added to icepulse_locations';
  ELSE
    RAISE NOTICE 'Unique constraint already exists on icepulse_locations';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error adding constraint: %', SQLERRM;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_icepulse_locations_organization ON icepulse_locations(organization_id);
CREATE INDEX IF NOT EXISTS idx_icepulse_locations_name ON icepulse_locations(name);
CREATE INDEX IF NOT EXISTS idx_icepulse_games_organization ON icepulse_games(organization_id);
CREATE INDEX IF NOT EXISTS idx_icepulse_games_team ON icepulse_games(team_id);
CREATE INDEX IF NOT EXISTS idx_icepulse_games_season ON icepulse_games(season_id);
CREATE INDEX IF NOT EXISTS idx_icepulse_games_date ON icepulse_games(game_date);
CREATE INDEX IF NOT EXISTS idx_icepulse_games_team_season ON icepulse_games(team_id, season_id);

-- Verify indexes
SELECT 
  'Indexes Created' as status,
  indexname
FROM pg_indexes
WHERE schemaname = 'public' 
  AND indexname LIKE 'idx_icepulse_%'
  AND tablename IN ('icepulse_locations', 'icepulse_games')
ORDER BY indexname;
