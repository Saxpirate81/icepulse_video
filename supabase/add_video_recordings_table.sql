-- Video Recordings Table
-- Stores video recordings tied to games with timestamps for synchronization

CREATE TABLE IF NOT EXISTS icepulse_video_recordings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES icepulse_games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES icepulse_profiles(id) ON DELETE CASCADE,
  team_id UUID REFERENCES icepulse_teams(id) ON DELETE SET NULL,
  season_id UUID REFERENCES icepulse_seasons(id) ON DELETE SET NULL,
  
  -- Video metadata
  video_url TEXT NOT NULL, -- URL to stored video file (Supabase Storage or external)
  thumbnail_url TEXT, -- Optional thumbnail
  duration_seconds INTEGER, -- Video duration in seconds
  file_size_bytes BIGINT, -- File size in bytes
  
  -- Timestamps for synchronization (CRITICAL)
  recording_start_timestamp TIMESTAMPTZ NOT NULL, -- When recording started (used for sync)
  recording_end_timestamp TIMESTAMPTZ, -- When recording ended
  game_start_timestamp TIMESTAMPTZ, -- Actual game start time (if known)
  
  -- Recording metadata
  recording_type TEXT DEFAULT 'full_game' CHECK (recording_type IN ('full_game', 'shift', 'period', 'custom')),
  description TEXT, -- Optional description (e.g., "Player shift", "First period")
  
  -- Status
  upload_status TEXT DEFAULT 'uploading' CHECK (upload_status IN ('uploading', 'processing', 'completed', 'failed')),
  processing_error TEXT, -- Error message if processing failed
  
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
