-- Step 5: Create RLS policies (run this last)
-- Run this after Step 4

-- Create policies for locations
CREATE POLICY "Org members can view locations"
  ON icepulse_locations FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT c.organization_id FROM icepulse_coaches c
      WHERE c.profile_id = auth.uid()
    )
  );

CREATE POLICY "Org members can manage locations"
  ON icepulse_locations FOR ALL
  USING (
    organization_id IN (
      SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT c.organization_id FROM icepulse_coaches c
      WHERE c.profile_id = auth.uid()
    )
  );

-- Create policies for games
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

-- Verify policies were created
SELECT 
  'Policies Created' as status,
  schemaname,
  tablename,
  policyname
FROM pg_policies 
WHERE tablename IN ('icepulse_locations', 'icepulse_games')
ORDER BY tablename, policyname;
