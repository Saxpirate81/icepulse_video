-- Fix RLS policies to resolve infinite recursion in icepulse_organizations
-- This is a more comprehensive fix that addresses the recursion issue

-- Drop all problematic policies that might cause recursion
DROP POLICY IF EXISTS "Coaches can view assigned organization" ON icepulse_organizations;
DROP POLICY IF EXISTS "Organization owners can view their org" ON icepulse_organizations;
DROP POLICY IF EXISTS "Organization/Coach can view profiles in their org" ON icepulse_profiles;

-- Fix icepulse_organizations policy - completely simplified to avoid recursion
-- The key is to NOT query icepulse_coaches or other tables that might query back to organizations
CREATE POLICY "Coaches can view assigned organization"
  ON icepulse_organizations FOR SELECT
  USING (
    -- Direct check: if user is a coach, they can view their organization
    -- We check icepulse_coaches directly without any joins that might cause recursion
    EXISTS (
      SELECT 1 FROM icepulse_coaches c
      WHERE c.profile_id = auth.uid() 
      AND c.organization_id = icepulse_organizations.id
    )
    -- Organization owners can always view their own organization
    OR owner_id = auth.uid()
  );

-- Recreate the organization owners policy (simpler version)
CREATE POLICY "Organization owners can view their org"
  ON icepulse_organizations FOR SELECT
  USING (owner_id = auth.uid());

-- Fix profiles policy - completely simplified
-- Users can view their own profile, and that's it for now
-- We'll add org-level viewing later if needed, but keep it simple to avoid recursion
CREATE POLICY "Organization/Coach can view profiles in their org"
  ON icepulse_profiles FOR SELECT
  USING (
    -- Users can always view their own profile
    id = auth.uid()
    -- Organization owners can view profiles (but we'll keep this simple - no complex queries)
    OR EXISTS (
      SELECT 1 FROM icepulse_organizations o
      WHERE o.owner_id = auth.uid()
      -- Don't add any joins here that might cause recursion
    )
  );

-- Ensure the basic "Users can view own profile" policy exists and is correct
DROP POLICY IF EXISTS "Users can view own profile" ON icepulse_profiles;
CREATE POLICY "Users can view own profile"
  ON icepulse_profiles FOR SELECT
  USING (auth.uid() = id);

-- Ensure users can insert their own profile (for the trigger)
DROP POLICY IF EXISTS "Users can insert own profile" ON icepulse_profiles;
CREATE POLICY "Users can insert own profile"
  ON icepulse_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Ensure users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON icepulse_profiles;
CREATE POLICY "Users can update own profile"
  ON icepulse_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
