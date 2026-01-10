-- Fix game creation timeout for parents/players
-- This ensures RLS policies are optimized and indexes exist

-- First, ensure the INSERT policies are optimized with (select auth.uid())
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

-- Ensure critical indexes exist for the RLS policy checks
CREATE INDEX IF NOT EXISTS idx_player_assignments_team_season_player 
  ON icepulse_player_assignments(team_id, season_id, player_id);

CREATE INDEX IF NOT EXISTS idx_parent_connections_parent_player 
  ON icepulse_parent_player_connections(parent_id, player_id);

CREATE INDEX IF NOT EXISTS idx_parents_profile_id 
  ON icepulse_parents(profile_id);

CREATE INDEX IF NOT EXISTS idx_players_profile_id 
  ON icepulse_players(profile_id);

CREATE INDEX IF NOT EXISTS idx_players_individual_user_id 
  ON icepulse_players(individual_user_id);

-- Analyze tables to update query planner
ANALYZE icepulse_games;
ANALYZE icepulse_player_assignments;
ANALYZE icepulse_parent_player_connections;
ANALYZE icepulse_parents;
ANALYZE icepulse_players;
