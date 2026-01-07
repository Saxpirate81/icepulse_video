-- Simple Fix: Just create tables and basic setup
-- This is the minimal version that should not timeout

-- Create locations table
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

-- Create games table
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
