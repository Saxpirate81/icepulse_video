-- Fix RLS policies for coach and player assignments
-- Add WITH CHECK clauses for INSERT operations

-- Drop existing policies
DROP POLICY IF EXISTS "Org members can manage coach assignments" ON icepulse_coach_assignments;
DROP POLICY IF EXISTS "Org members can manage player assignments" ON icepulse_player_assignments;

-- Recreate coach assignments policy with WITH CHECK
CREATE POLICY "Org members can manage coach assignments"
  ON icepulse_coach_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM icepulse_coaches c
      WHERE c.id = icepulse_coach_assignments.coach_id
      AND (
        c.organization_id IN (
          SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
          UNION
          SELECT c2.organization_id FROM icepulse_coaches c2
          WHERE c2.profile_id = auth.uid()
        )
        OR c.individual_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM icepulse_coaches c
      WHERE c.id = icepulse_coach_assignments.coach_id
      AND (
        c.organization_id IN (
          SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
          UNION
          SELECT c2.organization_id FROM icepulse_coaches c2
          WHERE c2.profile_id = auth.uid()
        )
        OR c.individual_user_id = auth.uid()
      )
    )
  );

-- Recreate player assignments policy with WITH CHECK
CREATE POLICY "Org members can manage player assignments"
  ON icepulse_player_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM icepulse_players p
      WHERE p.id = icepulse_player_assignments.player_id
      AND (
        p.organization_id IN (
          SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
          UNION
          SELECT c.organization_id FROM icepulse_coaches c
          WHERE c.profile_id = auth.uid()
        )
        OR p.individual_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM icepulse_players p
      WHERE p.id = icepulse_player_assignments.player_id
      AND (
        p.organization_id IN (
          SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
          UNION
          SELECT c.organization_id FROM icepulse_coaches c
          WHERE c.profile_id = auth.uid()
        )
        OR p.individual_user_id = auth.uid()
      )
    )
  );
