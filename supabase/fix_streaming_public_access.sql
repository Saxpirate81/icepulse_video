-- Allow public access to metadata for ACTIVE streams
-- This ensures viewers can see Team Name, Organization Name, etc.

-- 1. GAMES
CREATE POLICY "Public view games with active streams"
  ON icepulse_games FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM icepulse_streams
      WHERE icepulse_streams.game_id = icepulse_games.id
      AND icepulse_streams.is_active = true
    )
  );

-- 2. TEAMS
CREATE POLICY "Public view teams with active streams"
  ON icepulse_teams FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM icepulse_games g
      JOIN icepulse_streams s ON g.id = s.game_id
      WHERE g.team_id = icepulse_teams.id
      AND s.is_active = true
    )
  );

-- 3. ORGANIZATIONS
CREATE POLICY "Public view organizations with active streams"
  ON icepulse_organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM icepulse_games g
      JOIN icepulse_streams s ON g.id = s.game_id
      WHERE g.organization_id = icepulse_organizations.id
      AND s.is_active = true
    )
  );
