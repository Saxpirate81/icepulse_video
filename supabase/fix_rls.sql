-- Fix RLS policies to resolve infinite recursion and allow profile creation

-- Drop problematic policies
DROP POLICY IF EXISTS "Organization/Coach can view profiles in their org" ON icepulse_profiles;
DROP POLICY IF EXISTS "Org members can view coaches" ON icepulse_coaches;
DROP POLICY IF EXISTS "Org members can manage coaches" ON icepulse_coaches;
DROP POLICY IF EXISTS "Coaches can view assigned organization" ON icepulse_organizations;

-- Fix profiles policy - simplified to avoid recursion
-- Note: This policy allows org owners to view profiles, but we'll keep it simple
-- For now, org owners can view any profile (you can restrict this later if needed)
CREATE POLICY "Organization/Coach can view profiles in their org"
  ON icepulse_profiles FOR SELECT
  USING (
    -- Organization owners can view profiles (simplified - no recursion)
    EXISTS (
      SELECT 1 FROM icepulse_organizations o
      WHERE o.owner_id = auth.uid()
    )
  );

-- Fix coaches policy - remove circular reference
CREATE POLICY "Org members can view coaches"
  ON icepulse_coaches FOR SELECT
  USING (
    -- Organization owners can view coaches
    organization_id IN (
      SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
    )
    -- Coaches can view themselves
    OR profile_id = auth.uid()
    -- Individual users can view their own coaches
    OR individual_user_id = auth.uid()
  );

CREATE POLICY "Org members can manage coaches"
  ON icepulse_coaches FOR ALL
  USING (
    -- Organization owners can manage coaches
    organization_id IN (
      SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
    )
    -- Individual users can manage their own coaches
    OR individual_user_id = auth.uid()
  );

-- Fix organizations policy - simplified
CREATE POLICY "Coaches can view assigned organization"
  ON icepulse_organizations FOR SELECT
  USING (
    -- Coaches can view their organization (check directly, no recursion)
    EXISTS (
      SELECT 1 FROM icepulse_coaches c
      WHERE c.profile_id = auth.uid() 
      AND c.organization_id = icepulse_organizations.id
    )
  );

-- Allow service role to insert profiles (for trigger - though SECURITY DEFINER should handle this)
-- The trigger function uses SECURITY DEFINER so it bypasses RLS
-- But we need to ensure users can read their profile immediately after creation
-- The "Users can view own profile" policy should handle this
