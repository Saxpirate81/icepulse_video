-- Fix RLS Performance Warnings
-- This script optimizes RLS policies by wrapping auth.uid() in (select auth.uid())
-- to prevent re-evaluation for each row, and removes duplicate indexes

-- ============================================
-- FIX AUTH RLS INITIALIZATION PLAN WARNINGS
-- ============================================
-- Replace auth.uid() with (select auth.uid()) in RLS policies to cache the value

-- icepulse_video_recordings policies (CRITICAL - this is causing timeouts)
DROP POLICY IF EXISTS "Players and parents can view videos for their team games" ON icepulse_video_recordings;
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
          WHERE p.profile_id = (select auth.uid())
          AND pa.team_id = t.id
        )
        -- Or parent's child is on the team
        OR EXISTS (
          SELECT 1 FROM icepulse_parents par
          JOIN icepulse_parent_player_connections ppc ON par.id = ppc.parent_id
          JOIN icepulse_players p ON ppc.player_id = p.id
          JOIN icepulse_player_assignments pa ON p.id = pa.player_id
          WHERE par.profile_id = (select auth.uid())
          AND pa.team_id = t.id
        )
      )
    )
  );

DROP POLICY IF EXISTS "Organization and coaches can view videos for their games" ON icepulse_video_recordings;
CREATE POLICY "Organization and coaches can view videos for their games"
  ON icepulse_video_recordings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM icepulse_games g
      WHERE g.id = icepulse_video_recordings.game_id
      AND (
        g.organization_id IN (
          SELECT id FROM icepulse_organizations WHERE owner_id = (select auth.uid())
          UNION
          SELECT c.organization_id FROM icepulse_coaches c
          WHERE c.profile_id = (select auth.uid())
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can create their own video recordings" ON icepulse_video_recordings;
CREATE POLICY "Users can create their own video recordings"
  ON icepulse_video_recordings
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own video recordings" ON icepulse_video_recordings;
CREATE POLICY "Users can update their own video recordings"
  ON icepulse_video_recordings
  FOR UPDATE
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own video recordings" ON icepulse_video_recordings;
CREATE POLICY "Users can delete their own video recordings"
  ON icepulse_video_recordings
  FOR DELETE
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Organization and coaches can delete videos for their games" ON icepulse_video_recordings;
CREATE POLICY "Organization and coaches can delete videos for their games"
  ON icepulse_video_recordings
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM icepulse_games g
      WHERE g.id = icepulse_video_recordings.game_id
      AND (
        g.organization_id IN (
          SELECT id FROM icepulse_organizations WHERE owner_id = (select auth.uid())
          UNION
          SELECT c.organization_id FROM icepulse_coaches c
          WHERE c.profile_id = (select auth.uid())
        )
      )
    )
  );

-- icepulse_games policies
DROP POLICY IF EXISTS "Players can view games for assigned teams" ON icepulse_games;
CREATE POLICY "Players can view games for assigned teams"
  ON icepulse_games
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM icepulse_player_assignments pa
      JOIN icepulse_players p ON pa.player_id = p.id
      WHERE pa.team_id = icepulse_games.team_id
      AND pa.season_id = icepulse_games.season_id
      AND p.profile_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Parents can view games for connected players' teams" ON icepulse_games;
CREATE POLICY "Parents can view games for connected players' teams"
  ON icepulse_games
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM icepulse_player_assignments pa
      JOIN icepulse_parent_player_connections ppc ON pa.player_id = ppc.player_id
      JOIN icepulse_parents par ON ppc.parent_id = par.id
      WHERE pa.team_id = icepulse_games.team_id
      AND pa.season_id = icepulse_games.season_id
      AND par.profile_id = (select auth.uid())
    )
  );

-- Optimize INSERT policies for game creation (these were missing from the original fix)
DROP POLICY IF EXISTS "Players can create games for assigned teams" ON icepulse_games;
CREATE POLICY "Players can create games for assigned teams"
  ON icepulse_games
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM icepulse_player_assignments pa
      JOIN icepulse_players p ON pa.player_id = p.id
      WHERE pa.team_id = icepulse_games.team_id
      AND pa.season_id = icepulse_games.season_id
      AND (p.profile_id = (select auth.uid()) OR p.individual_user_id = (select auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Parents can create games for connected players' teams" ON icepulse_games;
CREATE POLICY "Parents can create games for connected players' teams"
  ON icepulse_games
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM icepulse_player_assignments pa
      JOIN icepulse_parent_player_connections ppc ON pa.player_id = ppc.player_id
      JOIN icepulse_parents par ON ppc.parent_id = par.id
      WHERE pa.team_id = icepulse_games.team_id
      AND pa.season_id = icepulse_games.season_id
      AND par.profile_id = (select auth.uid())
    )
  );

-- icepulse_teams policies
DROP POLICY IF EXISTS "Parents can view teams through player assignments" ON icepulse_teams;
CREATE POLICY "Parents can view teams through player assignments"
  ON icepulse_teams
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM icepulse_player_assignments pa
      JOIN icepulse_parent_player_connections ppc ON pa.player_id = ppc.player_id
      JOIN icepulse_parents p ON ppc.parent_id = p.id
      WHERE pa.team_id = icepulse_teams.id
      AND p.profile_id = (select auth.uid())
    )
    OR organization_id IN (
      SELECT id FROM icepulse_organizations WHERE owner_id = (select auth.uid())
      UNION
      SELECT c.organization_id FROM icepulse_coaches c
      WHERE c.profile_id = (select auth.uid())
    )
    OR individual_user_id = (select auth.uid())
  );

-- icepulse_seasons policies
DROP POLICY IF EXISTS "Parents can view seasons through player assignments" ON icepulse_seasons;
CREATE POLICY "Parents can view seasons through player assignments"
  ON icepulse_seasons
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM icepulse_player_assignments pa
      JOIN icepulse_parent_player_connections ppc ON pa.player_id = ppc.player_id
      JOIN icepulse_parents p ON ppc.parent_id = p.id
      WHERE pa.season_id = icepulse_seasons.id
      AND p.profile_id = (select auth.uid())
    )
    OR organization_id IN (
      SELECT id FROM icepulse_organizations WHERE owner_id = (select auth.uid())
      UNION
      SELECT c.organization_id FROM icepulse_coaches c
      WHERE c.profile_id = (select auth.uid())
    )
    OR individual_user_id = (select auth.uid())
  );

-- icepulse_player_assignments policies
DROP POLICY IF EXISTS "Parents can view child assignments" ON icepulse_player_assignments;
CREATE POLICY "Parents can view child assignments"
  ON icepulse_player_assignments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM icepulse_parent_player_connections ppc
      JOIN icepulse_parents par ON ppc.parent_id = par.id
      WHERE ppc.player_id = icepulse_player_assignments.player_id
      AND par.profile_id = (select auth.uid())
    )
  );

-- icepulse_players policies
DROP POLICY IF EXISTS "Parents can view connected players" ON icepulse_players;
CREATE POLICY "Parents can view connected players"
  ON icepulse_players
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM icepulse_parent_player_connections ppc
      JOIN icepulse_parents p ON ppc.parent_id = p.id
      WHERE ppc.player_id = icepulse_players.id
      AND p.profile_id = (select auth.uid())
    )
  );

-- ============================================
-- REMOVE DUPLICATE INDEXES
-- ============================================

-- Drop duplicate indexes (keeping the shorter-named ones)
DROP INDEX IF EXISTS idx_icepulse_coaches_profile;
DROP INDEX IF EXISTS idx_icepulse_games_organization;
DROP INDEX IF EXISTS idx_icepulse_games_team;
DROP INDEX IF EXISTS idx_parent_player_connections_parent_player;
DROP INDEX IF EXISTS idx_icepulse_parents_profile;
DROP INDEX IF EXISTS idx_icepulse_players_individual;
DROP INDEX IF EXISTS idx_icepulse_players_profile;
DROP INDEX IF EXISTS idx_stream_chunks_stream_id_fast;
DROP INDEX IF EXISTS idx_stream_chunks_stream_index;
DROP INDEX IF EXISTS idx_icepulse_teams_organization;
DROP INDEX IF EXISTS idx_video_recordings_user;

-- icepulse_streams policies (optimize auth.role() call)
DROP POLICY IF EXISTS "Authenticated users can create streams" ON icepulse_streams;
CREATE POLICY "Authenticated users can create streams"
  ON icepulse_streams
  FOR INSERT
  WITH CHECK ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Stream creators can update streams" ON icepulse_streams;
CREATE POLICY "Stream creators can update streams"
  ON icepulse_streams
  FOR UPDATE
  USING (created_by = (select auth.uid()));

-- icepulse_stream_chunks policies
DROP POLICY IF EXISTS "Users can insert chunks for their streams" ON icepulse_stream_chunks;
CREATE POLICY "Users can insert chunks for their streams"
  ON icepulse_stream_chunks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM icepulse_streams s
      WHERE s.id = icepulse_stream_chunks.stream_id
      AND s.created_by = (select auth.uid())
    )
  );

-- ============================================
-- ANALYZE TABLES
-- ============================================
-- Update query planner statistics after index changes
ANALYZE icepulse_video_recordings;
ANALYZE icepulse_games;
ANALYZE icepulse_teams;
ANALYZE icepulse_seasons;
ANALYZE icepulse_player_assignments;
ANALYZE icepulse_players;
ANALYZE icepulse_parents;
ANALYZE icepulse_parent_player_connections;
ANALYZE icepulse_streams;
ANALYZE icepulse_stream_chunks;