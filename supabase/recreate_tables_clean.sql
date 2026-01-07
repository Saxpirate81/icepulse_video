-- Recreate Tables Cleanly
-- Run this AFTER emergency_drop_tables.sql
-- This creates the tables step by step without foreign keys first

-- Step 1: Create locations table WITHOUT foreign keys
CREATE TABLE icepulse_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- Step 2: Create games table WITHOUT foreign keys
CREATE TABLE icepulse_games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL,
  team_id UUID NOT NULL,
  season_id UUID NOT NULL,
  game_date DATE NOT NULL,
  game_time TIME,
  opponent TEXT NOT NULL,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- Step 3: Add unique constraint to locations
ALTER TABLE icepulse_locations 
ADD CONSTRAINT icepulse_locations_organization_id_name_key 
UNIQUE(organization_id, name);

-- Step 4: Create indexes
CREATE INDEX idx_icepulse_locations_organization ON icepulse_locations(organization_id);
CREATE INDEX idx_icepulse_locations_name ON icepulse_locations(name);
CREATE INDEX idx_icepulse_games_organization ON icepulse_games(organization_id);
CREATE INDEX idx_icepulse_games_team ON icepulse_games(team_id);
CREATE INDEX idx_icepulse_games_season ON icepulse_games(season_id);
CREATE INDEX idx_icepulse_games_date ON icepulse_games(game_date);
CREATE INDEX idx_icepulse_games_team_season ON icepulse_games(team_id, season_id);

-- Step 5: Add foreign keys (one at a time)
ALTER TABLE icepulse_locations 
ADD CONSTRAINT icepulse_locations_organization_id_fkey 
FOREIGN KEY (organization_id) 
REFERENCES icepulse_organizations(id) 
ON DELETE CASCADE;

ALTER TABLE icepulse_locations 
ADD CONSTRAINT icepulse_locations_created_by_fkey 
FOREIGN KEY (created_by) 
REFERENCES icepulse_profiles(id) 
ON DELETE SET NULL;

ALTER TABLE icepulse_games 
ADD CONSTRAINT icepulse_games_organization_id_fkey 
FOREIGN KEY (organization_id) 
REFERENCES icepulse_organizations(id) 
ON DELETE CASCADE;

ALTER TABLE icepulse_games 
ADD CONSTRAINT icepulse_games_team_id_fkey 
FOREIGN KEY (team_id) 
REFERENCES icepulse_teams(id) 
ON DELETE CASCADE;

ALTER TABLE icepulse_games 
ADD CONSTRAINT icepulse_games_season_id_fkey 
FOREIGN KEY (season_id) 
REFERENCES icepulse_seasons(id) 
ON DELETE CASCADE;

ALTER TABLE icepulse_games 
ADD CONSTRAINT icepulse_games_created_by_fkey 
FOREIGN KEY (created_by) 
REFERENCES icepulse_profiles(id) 
ON DELETE SET NULL;

-- Step 6: Enable RLS
ALTER TABLE icepulse_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE icepulse_games ENABLE ROW LEVEL SECURITY;

-- Verify
SELECT 
  'Tables Created' as status,
  table_name
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name IN ('icepulse_locations', 'icepulse_games')
ORDER BY table_name;
