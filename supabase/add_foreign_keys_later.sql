-- Add Foreign Keys Later (run this AFTER tables are created)
-- This adds the foreign key constraints separately to avoid timeout

-- Add foreign keys to locations table
DO $$
BEGIN
  -- Check if foreign key already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'icepulse_locations_organization_id_fkey'
  ) THEN
    ALTER TABLE icepulse_locations 
    ADD CONSTRAINT icepulse_locations_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES icepulse_organizations(id) 
    ON DELETE CASCADE;
    RAISE NOTICE 'Added foreign key to icepulse_locations.organization_id';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'icepulse_locations_created_by_fkey'
  ) THEN
    ALTER TABLE icepulse_locations 
    ADD CONSTRAINT icepulse_locations_created_by_fkey 
    FOREIGN KEY (created_by) 
    REFERENCES icepulse_profiles(id) 
    ON DELETE SET NULL;
    RAISE NOTICE 'Added foreign key to icepulse_locations.created_by';
  END IF;
END $$;

-- Add foreign keys to games table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'icepulse_games_organization_id_fkey'
  ) THEN
    ALTER TABLE icepulse_games 
    ADD CONSTRAINT icepulse_games_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES icepulse_organizations(id) 
    ON DELETE CASCADE;
    RAISE NOTICE 'Added foreign key to icepulse_games.organization_id';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'icepulse_games_team_id_fkey'
  ) THEN
    ALTER TABLE icepulse_games 
    ADD CONSTRAINT icepulse_games_team_id_fkey 
    FOREIGN KEY (team_id) 
    REFERENCES icepulse_teams(id) 
    ON DELETE CASCADE;
    RAISE NOTICE 'Added foreign key to icepulse_games.team_id';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'icepulse_games_season_id_fkey'
  ) THEN
    ALTER TABLE icepulse_games 
    ADD CONSTRAINT icepulse_games_season_id_fkey 
    FOREIGN KEY (season_id) 
    REFERENCES icepulse_seasons(id) 
    ON DELETE CASCADE;
    RAISE NOTICE 'Added foreign key to icepulse_games.season_id';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'icepulse_games_created_by_fkey'
  ) THEN
    ALTER TABLE icepulse_games 
    ADD CONSTRAINT icepulse_games_created_by_fkey 
    FOREIGN KEY (created_by) 
    REFERENCES icepulse_profiles(id) 
    ON DELETE SET NULL;
    RAISE NOTICE 'Added foreign key to icepulse_games.created_by';
  END IF;
END $$;
