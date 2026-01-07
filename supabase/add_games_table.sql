-- Games/Schedule Table
-- This table stores game schedules for teams within seasons/tournaments

-- Drop existing policies if they exist (to avoid conflicts)
-- Note: These will only work if the table exists, so they're safe to run
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'icepulse_games') THEN
    DROP POLICY IF EXISTS "Org members can view games" ON icepulse_games;
    DROP POLICY IF EXISTS "Org members can manage games" ON icepulse_games;
  END IF;
END $$;

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS icepulse_games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES icepulse_organizations(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES icepulse_teams(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES icepulse_seasons(id) ON DELETE CASCADE,
  game_date DATE NOT NULL,
  game_time TIME,
  opponent TEXT NOT NULL,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES icepulse_profiles(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_icepulse_games_organization ON icepulse_games(organization_id);
CREATE INDEX IF NOT EXISTS idx_icepulse_games_team ON icepulse_games(team_id);
CREATE INDEX IF NOT EXISTS idx_icepulse_games_season ON icepulse_games(season_id);
CREATE INDEX IF NOT EXISTS idx_icepulse_games_date ON icepulse_games(game_date);
CREATE INDEX IF NOT EXISTS idx_icepulse_games_team_season ON icepulse_games(team_id, season_id);

-- Enable RLS
ALTER TABLE icepulse_games ENABLE ROW LEVEL SECURITY;

-- Organization owners and coaches can view games in their organization
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

-- Organization owners and coaches can manage games in their organization
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

-- Trigger for updated_at
CREATE TRIGGER update_icepulse_games_updated_at
  BEFORE UPDATE ON icepulse_games
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
