-- Fix RLS policy for profiles to ensure users can read their own profile
-- This addresses the 406 error when trying to read profiles after creation

-- Drop and recreate the "Users can view own profile" policy to ensure it works
DROP POLICY IF EXISTS "Users can view own profile" ON icepulse_profiles;

CREATE POLICY "Users can view own profile"
  ON icepulse_profiles FOR SELECT
  USING (auth.uid() = id);

-- Also ensure the policy allows reading during signup
-- The issue might be that auth.uid() isn't set yet during the read
-- But this should work after login

-- Verify the policy
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual -- This shows the USING clause
FROM pg_policies
WHERE tablename = 'icepulse_profiles'
  AND policyname = 'Users can view own profile';
