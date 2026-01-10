-- Fix RLS policies to allow parents and players to create games
-- This allows parents/players to create games for teams they're associated with

-- Add policy for players to create games for their assigned teams
CREATE POLICY "Players can create games for assigned teams"
  ON icepulse_games FOR INSERT
  WITH CHECK (
    -- Game's team_id must be in the player's assignments
    EXISTS (
      SELECT 1 FROM icepulse_player_assignments pa
      JOIN icepulse_players p ON pa.player_id = p.id
      WHERE pa.team_id = icepulse_games.team_id
      AND (
        p.profile_id = auth.uid()
        OR p.individual_user_id = auth.uid()
      )
    )
  );

-- Add policy for parents to create games for their connected players' teams
CREATE POLICY "Parents can create games for connected players' teams"
  ON icepulse_games FOR INSERT
  WITH CHECK (
    -- Game's team_id must be in a connected player's assignments
    EXISTS (
      SELECT 1 FROM icepulse_player_assignments pa
      JOIN icepulse_parent_player_connections ppc ON pa.player_id = ppc.player_id
      JOIN icepulse_parents par ON ppc.parent_id = par.id
      WHERE pa.team_id = icepulse_games.team_id
      AND par.profile_id = auth.uid()
    )
  );

-- Add policy for players to view games for their assigned teams
CREATE POLICY "Players can view games for assigned teams"
  ON icepulse_games FOR SELECT
  USING (
    -- Game's team_id must be in the player's assignments
    EXISTS (
      SELECT 1 FROM icepulse_player_assignments pa
      JOIN icepulse_players p ON pa.player_id = p.id
      WHERE pa.team_id = icepulse_games.team_id
      AND (
        p.profile_id = auth.uid()
        OR p.individual_user_id = auth.uid()
      )
    )
    -- Or game belongs to organization (existing policy)
    OR organization_id IN (
      SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT c.organization_id FROM icepulse_coaches c
      WHERE c.profile_id = auth.uid()
    )
  );

-- Add policy for parents to view games for their connected players' teams
CREATE POLICY "Parents can view games for connected players' teams"
  ON icepulse_games FOR SELECT
  USING (
    -- Game's team_id must be in a connected player's assignments
    EXISTS (
      SELECT 1 FROM icepulse_player_assignments pa
      JOIN icepulse_parent_player_connections ppc ON pa.player_id = ppc.player_id
      JOIN icepulse_parents par ON ppc.parent_id = par.id
      WHERE pa.team_id = icepulse_games.team_id
      AND par.profile_id = auth.uid()
    )
    -- Or game belongs to organization (existing policy)
    OR organization_id IN (
      SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT c.organization_id FROM icepulse_coaches c
      WHERE c.profile_id = auth.uid()
    )
  );

-- Note: These policies are additive - they add to existing policies
-- The existing "Org members can view/manage games" policies remain in effect
