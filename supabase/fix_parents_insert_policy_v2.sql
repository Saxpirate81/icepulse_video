-- Fix RLS policy for icepulse_parents INSERT operations
-- Drop ALL existing policies first to avoid conflicts

DROP POLICY IF EXISTS "Org members can manage parents" ON icepulse_parents;
DROP POLICY IF EXISTS "Org members can view parents" ON icepulse_parents;
DROP POLICY IF EXISTS "Org members can update parents" ON icepulse_parents;
DROP POLICY IF EXISTS "Org members can delete parents" ON icepulse_parents;
DROP POLICY IF EXISTS "Org members can insert parents" ON icepulse_parents;

-- Create separate policies for each operation
-- SELECT uses USING
CREATE POLICY "Org members can view parents"
  ON icepulse_parents
  FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT c.organization_id FROM icepulse_coaches c
      WHERE c.profile_id = auth.uid()
    )
    OR profile_id = auth.uid()
  );

-- UPDATE uses USING (for existing rows) and WITH CHECK (for updated values)
CREATE POLICY "Org members can update parents"
  ON icepulse_parents
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT c.organization_id FROM icepulse_coaches c
      WHERE c.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT c.organization_id FROM icepulse_coaches c
      WHERE c.profile_id = auth.uid()
    )
  );

-- DELETE uses USING
CREATE POLICY "Org members can delete parents"
  ON icepulse_parents
  FOR DELETE
  USING (
    organization_id IN (
      SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT c.organization_id FROM icepulse_coaches c
      WHERE c.profile_id = auth.uid()
    )
  );

-- INSERT uses WITH CHECK (this is the critical one for adding parents)
CREATE POLICY "Org members can insert parents"
  ON icepulse_parents
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT c.organization_id FROM icepulse_coaches c
      WHERE c.profile_id = auth.uid()
    )
  );
