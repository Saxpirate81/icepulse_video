-- ============================================
-- COMPLETE DATABASE SETUP - ALL TABLES
-- Run this ONCE after Supabase is back up
-- ============================================
-- 
-- This script creates:
-- 1. icepulse_locations (rink/arena locations)
-- 2. icepulse_games (game schedules)
-- 3. icepulse_video_recordings (video metadata with timestamps)
--
-- ⚠️ WARNING: This will DROP existing tables if they exist!
-- ============================================

-- ============================================
-- STEP 1: DROP EXISTING TABLES (If Broken)
-- ============================================

-- Drop policies first
DROP POLICY IF EXISTS "Org members can view games" ON icepulse_games;
DROP POLICY IF EXISTS "Org members can manage games" ON icepulse_games;
DROP POLICY IF EXISTS "Organization and coaches can view locations" ON icepulse_locations;
DROP POLICY IF EXISTS "Organization and coaches can manage locations" ON icepulse_locations;
DROP POLICY IF EXISTS "Organization and coaches can view videos for their games" ON icepulse_video_recordings;
DROP POLICY IF EXISTS "Players and parents can view videos for their team games" ON icepulse_video_recordings;
DROP POLICY IF EXISTS "Users can create their own video recordings" ON icepulse_video_recordings;
DROP POLICY IF EXISTS "Users can update their own video recordings" ON icepulse_video_recordings;
DROP POLICY IF EXISTS "Users can delete their own video recordings" ON icepulse_video_recordings;
DROP POLICY IF EXISTS "Organization and coaches can delete videos for their games" ON icepulse_video_recordings;

-- Drop tables (CASCADE will drop dependent objects)
DROP TABLE IF EXISTS icepulse_video_recordings CASCADE;
DROP TABLE IF EXISTS icepulse_games CASCADE;
DROP TABLE IF EXISTS icepulse_locations CASCADE;

-- ============================================
-- STEP 2: CREATE LOCATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS icepulse_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES icepulse_organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  created_by UUID REFERENCES icepulse_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_icepulse_locations_organization ON icepulse_locations(organization_id);
CREATE INDEX IF NOT EXISTS idx_icepulse_locations_name ON icepulse_locations(name);

-- Enable RLS
ALTER TABLE icepulse_locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Organization and coaches can view locations"
  ON icepulse_locations FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT c.organization_id FROM icepulse_coaches c
      WHERE c.profile_id = auth.uid()
    )
  );

CREATE POLICY "Organization and coaches can manage locations"
  ON icepulse_locations FOR ALL
  USING (
    organization_id IN (
      SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT c.organization_id FROM icepulse_coaches c
      WHERE c.profile_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_icepulse_locations_updated_at
  BEFORE UPDATE ON icepulse_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STEP 3: CREATE GAMES/SCHEDULE TABLE
-- ============================================

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_icepulse_games_organization ON icepulse_games(organization_id);
CREATE INDEX IF NOT EXISTS idx_icepulse_games_team ON icepulse_games(team_id);
CREATE INDEX IF NOT EXISTS idx_icepulse_games_season ON icepulse_games(season_id);
CREATE INDEX IF NOT EXISTS idx_icepulse_games_date ON icepulse_games(game_date);
CREATE INDEX IF NOT EXISTS idx_icepulse_games_team_season ON icepulse_games(team_id, season_id);

-- Enable RLS
ALTER TABLE icepulse_games ENABLE ROW LEVEL SECURITY;

-- RLS Policies
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

-- Trigger for updated_at
CREATE TRIGGER update_icepulse_games_updated_at
  BEFORE UPDATE ON icepulse_games
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STEP 4: CREATE VIDEO RECORDINGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS icepulse_video_recordings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES icepulse_games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES icepulse_profiles(id) ON DELETE CASCADE,
  team_id UUID REFERENCES icepulse_teams(id) ON DELETE SET NULL,
  season_id UUID REFERENCES icepulse_seasons(id) ON DELETE SET NULL,
  
  -- Video metadata
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  file_size_bytes BIGINT,
  
  -- Timestamps for synchronization (CRITICAL)
  recording_start_timestamp TIMESTAMPTZ NOT NULL,
  recording_end_timestamp TIMESTAMPTZ,
  game_start_timestamp TIMESTAMPTZ,
  
  -- Recording metadata
  recording_type TEXT DEFAULT 'full_game' CHECK (recording_type IN ('full_game', 'shift', 'period', 'custom')),
  description TEXT,
  
  -- Status
  upload_status TEXT DEFAULT 'uploading' CHECK (upload_status IN ('uploading', 'processing', 'completed', 'failed')),
  processing_error TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_recordings_game ON icepulse_video_recordings(game_id);
CREATE INDEX IF NOT EXISTS idx_video_recordings_user ON icepulse_video_recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_video_recordings_team ON icepulse_video_recordings(team_id);
CREATE INDEX IF NOT EXISTS idx_video_recordings_season ON icepulse_video_recordings(season_id);
CREATE INDEX IF NOT EXISTS idx_video_recordings_start_timestamp ON icepulse_video_recordings(recording_start_timestamp);
CREATE INDEX IF NOT EXISTS idx_video_recordings_upload_status ON icepulse_video_recordings(upload_status);

-- Enable RLS
ALTER TABLE icepulse_video_recordings ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Organization owners and coaches can view all videos for their organization's games
CREATE POLICY "Organization and coaches can view videos for their games"
  ON icepulse_video_recordings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM icepulse_games g
      JOIN icepulse_teams t ON g.team_id = t.id
      JOIN icepulse_organizations o ON t.organization_id = o.id
      WHERE g.id = icepulse_video_recordings.game_id
      AND (
        o.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM icepulse_coaches c
          JOIN icepulse_coach_assignments ca ON c.id = ca.coach_id
          WHERE c.profile_id = auth.uid()
          AND ca.team_id = t.id
        )
      )
    )
  );

-- Players and parents can view videos for games their teams are in
CREATE POLICY "Players and parents can view videos for their team games"
  ON icepulse_video_recordings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM icepulse_games g
      JOIN icepulse_teams t ON g.team_id = t.id
      WHERE g.id = icepulse_video_recordings.game_id
      AND (
        -- Player is on the team
        EXISTS (
          SELECT 1 FROM icepulse_players p
          JOIN icepulse_player_assignments pa ON p.id = pa.player_id
          WHERE p.profile_id = auth.uid()
          AND pa.team_id = t.id
        )
        -- Or parent's child is on the team
        OR EXISTS (
          SELECT 1 FROM icepulse_parents par
          JOIN icepulse_parent_player_connections ppc ON par.id = ppc.parent_id
          JOIN icepulse_players p ON ppc.player_id = p.id
          JOIN icepulse_player_assignments pa ON p.id = pa.player_id
          WHERE par.profile_id = auth.uid()
          AND pa.team_id = t.id
        )
      )
    )
  );

-- Users can insert their own recordings
CREATE POLICY "Users can create their own video recordings"
  ON icepulse_video_recordings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own recordings
CREATE POLICY "Users can update their own video recordings"
  ON icepulse_video_recordings
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own recordings
CREATE POLICY "Users can delete their own video recordings"
  ON icepulse_video_recordings
  FOR DELETE
  USING (auth.uid() = user_id);

-- Organization owners and coaches can delete any video for their organization
CREATE POLICY "Organization and coaches can delete videos for their games"
  ON icepulse_video_recordings
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM icepulse_games g
      JOIN icepulse_teams t ON g.team_id = t.id
      JOIN icepulse_organizations o ON t.organization_id = o.id
      WHERE g.id = icepulse_video_recordings.game_id
      AND (
        o.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM icepulse_coaches c
          JOIN icepulse_coach_assignments ca ON c.id = ca.coach_id
          WHERE c.profile_id = auth.uid()
          AND ca.team_id = t.id
        )
      )
    )
  );

-- Trigger to update updated_at
CREATE TRIGGER update_video_recordings_updated_at
  BEFORE UPDATE ON icepulse_video_recordings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STEP 5: VERIFY CREATION
-- ============================================

-- Check tables exist
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('icepulse_locations', 'icepulse_games', 'icepulse_video_recordings')
ORDER BY table_name;

-- Check RLS is enabled
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('icepulse_locations', 'icepulse_games', 'icepulse_video_recordings')
ORDER BY tablename;

-- Check policies exist
SELECT 
  tablename,
  policyname,
  cmd as command
FROM pg_policies
WHERE tablename IN ('icepulse_locations', 'icepulse_games', 'icepulse_video_recordings')
ORDER BY tablename, policyname;

-- ============================================
-- DONE!
-- ============================================
-- 
-- Next steps:
-- 1. Create storage bucket for videos (see COMPLETE_DATABASE_SETUP.md)
-- 2. Disable mock mode in application
-- 3. Test game creation
-- 4. Test video recording
-- ============================================
