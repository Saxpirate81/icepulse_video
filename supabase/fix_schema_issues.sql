-- Fix Schema Issues
-- Run this if Supabase can't pull up schemas
-- This will safely create tables and policies

-- First, check if tables exist and drop policies if they do
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Org members can view locations" ON icepulse_locations;
  DROP POLICY IF EXISTS "Org members can manage locations" ON icepulse_locations;
  DROP POLICY IF EXISTS "Org members can view games" ON icepulse_games;
  DROP POLICY IF EXISTS "Org members can manage games" ON icepulse_games;
END $$;

-- Create locations table if it doesn't exist
CREATE TABLE IF NOT EXISTS icepulse_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES icepulse_organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES icepulse_profiles(id) ON DELETE SET NULL
);

-- Create games table if it doesn't exist
CREATE TABLE IF NOT EXISTS icepulse_games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES icepulse_organizations(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES icepulse_teams(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES icepulse_seasons(id) ON DELETE CASCADE,
  game_date DATE NOT NULL,
  game_time TIME NOT NULL,
  opponent TEXT NOT NULL,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES icepulse_profiles(id) ON DELETE SET NULL
);

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
  END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_icepulse_locations_organization ON icepulse_locations(organization_id);
CREATE INDEX IF NOT EXISTS idx_icepulse_locations_name ON icepulse_locations(name);
CREATE INDEX IF NOT EXISTS idx_icepulse_games_organization ON icepulse_games(organization_id);
CREATE INDEX IF NOT EXISTS idx_icepulse_games_team ON icepulse_games(team_id);
CREATE INDEX IF NOT EXISTS idx_icepulse_games_season ON icepulse_games(season_id);
CREATE INDEX IF NOT EXISTS idx_icepulse_games_date ON icepulse_games(game_date);
CREATE INDEX IF NOT EXISTS idx_icepulse_games_team_season ON icepulse_games(team_id, season_id);

-- Enable RLS
ALTER TABLE icepulse_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE icepulse_games ENABLE ROW LEVEL SECURITY;

-- Create policies for locations
CREATE POLICY "Org members can view locations"
  ON icepulse_locations FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT c.organization_id FROM icepulse_coaches c
      WHERE c.profile_id = auth.uid()
    )
  );

CREATE POLICY "Org members can manage locations"
  ON icepulse_locations FOR ALL
  USING (
    organization_id IN (
      SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT c.organization_id FROM icepulse_coaches c
      WHERE c.profile_id = auth.uid()
    )
  );

-- Create policies for games
CREATE POLICY "Org members can view games"
  ON icepulse_games FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT c.organization_id FROM icepulse_coaches c
      WHERE c.profile_id = auth.uid()
    )
  );

CREATE POLICY "Org members can manage games"
  ON icepulse_games FOR ALL
  USING (
    organization_id IN (
      SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT c.organization_id FROM icepulse_coaches c
      WHERE c.profile_id = auth.uid()
    )
  );

-- Verify tables were created
SELECT 
  'Tables Created' as status,
  table_name
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name IN ('icepulse_locations', 'icepulse_games')
ORDER BY table_name;
