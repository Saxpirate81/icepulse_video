-- AGGRESSIVE RLS FIX - Removes ALL problematic policies and recreates simple ones
-- This will fix the infinite recursion issue immediately

-- ============================================
-- STEP 1: Drop ALL existing policies on problematic tables
-- ============================================

-- Drop all policies on icepulse_organizations
DROP POLICY IF EXISTS "Coaches can view assigned organization" ON icepulse_organizations;
DROP POLICY IF EXISTS "Owners can view own organization" ON icepulse_organizations;
DROP POLICY IF EXISTS "Organization owners can view their org" ON icepulse_organizations;
DROP POLICY IF EXISTS "Owners can update own organization" ON icepulse_organizations;
DROP POLICY IF EXISTS "Owners can insert own organization" ON icepulse_organizations;

-- Drop all policies on icepulse_profiles that might cause issues
DROP POLICY IF EXISTS "Organization/Coach can view profiles in their org" ON icepulse_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON icepulse_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON icepulse_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON icepulse_profiles;

-- ============================================
-- STEP 2: Create SIMPLE, non-recursive policies
-- ============================================

-- PROFILES: Users can only view/insert/update their own profile
-- This is the most important one - it must work for signup to succeed
CREATE POLICY "Users can view own profile"
  ON icepulse_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON icepulse_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON icepulse_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ORGANIZATIONS: Simple policies without any joins or complex queries
CREATE POLICY "Owners can view own organization"
  ON icepulse_organizations FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Owners can update own organization"
  ON icepulse_organizations FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can insert own organization"
  ON icepulse_organizations FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- Coaches can view their organization (simplified - no recursion)
-- We'll add this back later if needed, but for now keep it simple
-- CREATE POLICY "Coaches can view assigned organization"
--   ON icepulse_organizations FOR SELECT
--   USING (
--     EXISTS (
--       SELECT 1 FROM icepulse_coaches c
--       WHERE c.profile_id = auth.uid() 
--       AND c.organization_id = icepulse_organizations.id
--     )
--   );

-- ============================================
-- STEP 3: Verify policies were created
-- ============================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('icepulse_profiles', 'icepulse_organizations')
ORDER BY tablename, policyname;
