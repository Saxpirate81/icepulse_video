-- Fix RLS policies to allow parents to view teams/seasons through their connected players
-- This allows parents to see teams/seasons that their children are assigned to

-- Add policy for parents to view teams through player assignments
CREATE POLICY "Parents can view teams through player assignments"
  ON icepulse_teams FOR SELECT
  USING (
    -- Team is assigned to a player that is connected to a parent
    EXISTS (
      SELECT 1 FROM icepulse_player_assignments pa
      JOIN icepulse_parent_player_connections ppc ON pa.player_id = ppc.player_id
      JOIN icepulse_parents p ON ppc.parent_id = p.id
      WHERE pa.team_id = icepulse_teams.id
      AND p.profile_id = auth.uid()
    )
    -- Or team belongs to organization (existing policy)
    OR organization_id IN (
      SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT c.organization_id FROM icepulse_coaches c
      WHERE c.profile_id = auth.uid()
    )
    -- Or team belongs to individual user (existing policy)
    OR individual_user_id = auth.uid()
  );

-- Add policy for parents to view seasons through player assignments
CREATE POLICY "Parents can view seasons through player assignments"
  ON icepulse_seasons FOR SELECT
  USING (
    -- Season is assigned to a player that is connected to a parent
    EXISTS (
      SELECT 1 FROM icepulse_player_assignments pa
      JOIN icepulse_parent_player_connections ppc ON pa.player_id = ppc.player_id
      JOIN icepulse_parents p ON ppc.parent_id = p.id
      WHERE pa.season_id = icepulse_seasons.id
      AND p.profile_id = auth.uid()
    )
    -- Or season belongs to organization (existing policy)
    OR organization_id IN (
      SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT c.organization_id FROM icepulse_coaches c
      WHERE c.profile_id = auth.uid()
    )
    -- Or season belongs to individual user (existing policy)
    OR individual_user_id = auth.uid()
  );

-- Note: These policies are additive - they add to existing policies
-- The existing "Org members can view teams/seasons" policies remain in effect
