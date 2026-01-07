
-- IcePulseVideo Database Schema
-- This file contains all table definitions and relationships

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- AUTHENTICATION & USERS
-- ============================================

-- User profiles (extends Supabase auth.users)
CREATE TABLE icepulse_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  account_type TEXT NOT NULL CHECK (account_type IN ('individual', 'organization')),
  role TEXT NOT NULL CHECK (role IN ('organization', 'coach', 'player', 'parent', 'game_recorder')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ORGANIZATIONS
-- ============================================

CREATE TABLE icepulse_organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES icepulse_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id)
);

-- ============================================
-- TEAMS
-- ============================================

CREATE TABLE icepulse_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES icepulse_organizations(id) ON DELETE CASCADE,
  individual_user_id UUID REFERENCES icepulse_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (
    (organization_id IS NOT NULL AND individual_user_id IS NULL) OR
    (organization_id IS NULL AND individual_user_id IS NOT NULL)
  )
);

-- ============================================
-- SEASONS/TOURNAMENTS
-- ============================================

CREATE TABLE icepulse_seasons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES icepulse_organizations(id) ON DELETE CASCADE,
  individual_user_id UUID REFERENCES icepulse_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('season', 'tournament')),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (
    (organization_id IS NOT NULL AND individual_user_id IS NULL) OR
    (organization_id IS NULL AND individual_user_id IS NOT NULL)
  )
);

-- ============================================
-- COACHES
-- ============================================

CREATE TABLE icepulse_coaches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES icepulse_organizations(id) ON DELETE CASCADE,
  individual_user_id UUID REFERENCES icepulse_profiles(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES icepulse_profiles(id) ON DELETE SET NULL, -- If coach is an existing user
  full_name TEXT NOT NULL,
  email TEXT,
  is_existing_user BOOLEAN DEFAULT FALSE,
  invite_sent BOOLEAN DEFAULT FALSE,
  invite_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (
    (organization_id IS NOT NULL AND individual_user_id IS NULL) OR
    (organization_id IS NULL AND individual_user_id IS NOT NULL)
  )
);

-- Coach team assignments (many-to-many)
CREATE TABLE icepulse_coach_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coach_id UUID NOT NULL REFERENCES icepulse_coaches(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES icepulse_teams(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES icepulse_seasons(id) ON DELETE CASCADE,
  assigned_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(coach_id, team_id, season_id)
);

-- ============================================
-- PLAYERS
-- ============================================

CREATE TABLE icepulse_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES icepulse_organizations(id) ON DELETE CASCADE,
  individual_user_id UUID REFERENCES icepulse_profiles(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES icepulse_profiles(id) ON DELETE SET NULL, -- If player is an existing user
  full_name TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  is_existing_user BOOLEAN DEFAULT FALSE,
  invite_sent BOOLEAN DEFAULT FALSE,
  invite_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (
    (organization_id IS NOT NULL AND individual_user_id IS NULL) OR
    (organization_id IS NULL AND individual_user_id IS NOT NULL)
  )
);

-- Player team assignments (many-to-many with jersey numbers)
CREATE TABLE icepulse_player_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID NOT NULL REFERENCES icepulse_players(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES icepulse_teams(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES icepulse_seasons(id) ON DELETE CASCADE,
  jersey_number INTEGER,
  position TEXT,
  assigned_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, team_id, season_id)
);

-- Jersey number history (preserves historical jersey numbers)
CREATE TABLE icepulse_jersey_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_assignment_id UUID NOT NULL REFERENCES icepulse_player_assignments(id) ON DELETE CASCADE,
  jersey_number INTEGER NOT NULL,
  changed_date TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PARENTS
-- ============================================

CREATE TABLE icepulse_parents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES icepulse_organizations(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES icepulse_profiles(id) ON DELETE SET NULL, -- If parent is an existing user
  full_name TEXT NOT NULL,
  email TEXT,
  is_existing_user BOOLEAN DEFAULT FALSE,
  invite_sent BOOLEAN DEFAULT FALSE,
  invite_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Parent-Player connections (many-to-many)
CREATE TABLE icepulse_parent_player_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID NOT NULL REFERENCES icepulse_parents(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES icepulse_players(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parent_id, player_id)
);

-- ============================================
-- INDEXES for Performance
-- ============================================

CREATE INDEX idx_icepulse_profiles_email ON icepulse_profiles(email);
CREATE INDEX idx_icepulse_profiles_role ON icepulse_profiles(role);
CREATE INDEX idx_icepulse_organizations_owner ON icepulse_organizations(owner_id);
CREATE INDEX idx_icepulse_teams_organization ON icepulse_teams(organization_id);
CREATE INDEX idx_icepulse_teams_individual ON icepulse_teams(individual_user_id);
CREATE INDEX idx_icepulse_seasons_organization ON icepulse_seasons(organization_id);
CREATE INDEX idx_icepulse_seasons_individual ON icepulse_seasons(individual_user_id);
CREATE INDEX idx_icepulse_coaches_organization ON icepulse_coaches(organization_id);
CREATE INDEX idx_icepulse_coaches_individual ON icepulse_coaches(individual_user_id);
CREATE INDEX idx_icepulse_coaches_profile ON icepulse_coaches(profile_id);
CREATE INDEX idx_icepulse_coach_assignments_coach ON icepulse_coach_assignments(coach_id);
CREATE INDEX idx_icepulse_coach_assignments_team ON icepulse_coach_assignments(team_id);
CREATE INDEX idx_icepulse_coach_assignments_season ON icepulse_coach_assignments(season_id);
CREATE INDEX idx_icepulse_players_organization ON icepulse_players(organization_id);
CREATE INDEX idx_icepulse_players_individual ON icepulse_players(individual_user_id);
CREATE INDEX idx_icepulse_players_profile ON icepulse_players(profile_id);
CREATE INDEX idx_icepulse_player_assignments_player ON icepulse_player_assignments(player_id);
CREATE INDEX idx_icepulse_player_assignments_team ON icepulse_player_assignments(team_id);
CREATE INDEX idx_icepulse_player_assignments_season ON icepulse_player_assignments(season_id);
CREATE INDEX idx_icepulse_jersey_history_assignment ON icepulse_jersey_history(player_assignment_id);
CREATE INDEX idx_icepulse_parents_organization ON icepulse_parents(organization_id);
CREATE INDEX idx_icepulse_parents_profile ON icepulse_parents(profile_id);
CREATE INDEX idx_icepulse_parent_player_connections_parent ON icepulse_parent_player_connections(parent_id);
CREATE INDEX idx_icepulse_parent_player_connections_player ON icepulse_parent_player_connections(player_id);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_icepulse_profiles_updated_at BEFORE UPDATE ON icepulse_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_icepulse_organizations_updated_at BEFORE UPDATE ON icepulse_organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_icepulse_teams_updated_at BEFORE UPDATE ON icepulse_teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_icepulse_seasons_updated_at BEFORE UPDATE ON icepulse_seasons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_icepulse_coaches_updated_at BEFORE UPDATE ON icepulse_coaches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_icepulse_players_updated_at BEFORE UPDATE ON icepulse_players
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_icepulse_parents_updated_at BEFORE UPDATE ON icepulse_parents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO icepulse_profiles (id, email, name, account_type, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'account_type', 'individual'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'player')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to track jersey number history
CREATE OR REPLACE FUNCTION track_jersey_history()
RETURNS TRIGGER AS $$
BEGIN
  -- If jersey number changed and old value exists, save to history
  IF OLD.jersey_number IS NOT NULL AND 
     NEW.jersey_number IS NOT NULL AND 
     OLD.jersey_number != NEW.jersey_number THEN
    INSERT INTO icepulse_jersey_history (player_assignment_id, jersey_number)
    VALUES (NEW.id, OLD.jersey_number);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to track jersey number changes
CREATE TRIGGER track_jersey_changes
  AFTER UPDATE ON icepulse_player_assignments
  FOR EACH ROW
  WHEN (OLD.jersey_number IS DISTINCT FROM NEW.jersey_number)
  EXECUTE FUNCTION track_jersey_history();
