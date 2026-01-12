-- Fix for infinite recursion in RLS policies
-- The issue is that checking "Am I a coach?" requires querying the coaches table,
-- which triggers the policy again, creating an infinite loop.

-- 1. Create a secure helper function to get organization IDs for the current user
-- SECURITY DEFINER allows this function to bypass RLS when running
CREATE OR REPLACE FUNCTION get_auth_user_org_ids()
RETURNS TABLE (org_id UUID) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
  UNION
  SELECT organization_id FROM icepulse_coaches WHERE profile_id = auth.uid();
END;
$$;

-- 2. Drop existing problematic policies on icepulse_coaches
DROP POLICY IF EXISTS "Org members can view coaches" ON icepulse_coaches;
DROP POLICY IF EXISTS "Org members can manage coaches" ON icepulse_coaches;

-- 3. Re-create policies using the helper function (breaking the recursion)

-- View policy
CREATE POLICY "Org members can view coaches"
  ON icepulse_coaches FOR SELECT
  USING (
    organization_id IN (SELECT org_id FROM get_auth_user_org_ids())
    OR individual_user_id = auth.uid()
    OR profile_id = auth.uid()
  );

-- Manage policy
CREATE POLICY "Org members can manage coaches"
  ON icepulse_coaches FOR ALL
  USING (
    organization_id IN (SELECT org_id FROM get_auth_user_org_ids())
    OR individual_user_id = auth.uid()
  );


-- 4. Apply similar optimization to other tables to prevent similar recursion issues
-- and improve performance

-- TEAMS
DROP POLICY IF EXISTS "Org members can view teams" ON icepulse_teams;
DROP POLICY IF EXISTS "Org members can manage teams" ON icepulse_teams;

CREATE POLICY "Org members can view teams"
  ON icepulse_teams FOR SELECT
  USING (
    organization_id IN (SELECT org_id FROM get_auth_user_org_ids())
    OR individual_user_id = auth.uid()
  );

CREATE POLICY "Org members can manage teams"
  ON icepulse_teams FOR ALL
  USING (
    organization_id IN (SELECT org_id FROM get_auth_user_org_ids())
    OR individual_user_id = auth.uid()
  );

-- SEASONS
DROP POLICY IF EXISTS "Org members can view seasons" ON icepulse_seasons;
DROP POLICY IF EXISTS "Org members can manage seasons" ON icepulse_seasons;

CREATE POLICY "Org members can view seasons"
  ON icepulse_seasons FOR SELECT
  USING (
    organization_id IN (SELECT org_id FROM get_auth_user_org_ids())
    OR individual_user_id = auth.uid()
  );

CREATE POLICY "Org members can manage seasons"
  ON icepulse_seasons FOR ALL
  USING (
    organization_id IN (SELECT org_id FROM get_auth_user_org_ids())
    OR individual_user_id = auth.uid()
  );

-- PLAYERS (Optimization)
DROP POLICY IF EXISTS "Org members can view players" ON icepulse_players;
DROP POLICY IF EXISTS "Org members can manage players" ON icepulse_players;

CREATE POLICY "Org members can view players"
  ON icepulse_players FOR SELECT
  USING (
    organization_id IN (SELECT org_id FROM get_auth_user_org_ids())
    OR individual_user_id = auth.uid()
    OR profile_id = auth.uid()
  );

CREATE POLICY "Org members can manage players"
  ON icepulse_players FOR ALL
  USING (
    organization_id IN (SELECT org_id FROM get_auth_user_org_ids())
    OR individual_user_id = auth.uid()
  );

-- COACH ASSIGNMENTS
DROP POLICY IF EXISTS "Org members can view coach assignments" ON icepulse_coach_assignments;
DROP POLICY IF EXISTS "Org members can manage coach assignments" ON icepulse_coach_assignments;

CREATE POLICY "Org members can view coach assignments"
  ON icepulse_coach_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM icepulse_coaches c
      WHERE c.id = icepulse_coach_assignments.coach_id
      AND (
        c.organization_id IN (SELECT org_id FROM get_auth_user_org_ids())
        OR c.individual_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Org members can manage coach assignments"
  ON icepulse_coach_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM icepulse_coaches c
      WHERE c.id = icepulse_coach_assignments.coach_id
      AND (
        c.organization_id IN (SELECT org_id FROM get_auth_user_org_ids())
        OR c.individual_user_id = auth.uid()
      )
    )
  );
