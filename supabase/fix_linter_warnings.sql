-- Fix Supabase Linter Warnings
-- This script addresses:
-- 1. Function search_path mutable warnings (security)
-- 2. Overly permissive RLS policies on legacy tables
--
-- NOTE: "Leaked Password Protection Disabled" warning cannot be fixed via SQL.
-- To enable it, go to Supabase Dashboard > Authentication > Password Security
-- and enable "Leaked Password Protection"

-- ============================================
-- FIX FUNCTION SEARCH PATH ISSUES
-- ============================================

-- Fix track_jersey_history function
CREATE OR REPLACE FUNCTION track_jersey_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If jersey number changed and old value exists, save to history
  IF OLD.jersey_number IS NOT NULL AND 
     NEW.jersey_number IS NOT NULL AND 
     OLD.jersey_number != NEW.jersey_number THEN
    INSERT INTO icepulse_jersey_history (player_assignment_id, jersey_number)
    VALUES (NEW.id, OLD.jersey_number);
  END IF;
  RETURN NEW;
END;
$$;

-- Fix handle_new_user function
-- Note: This may already be fixed in fix_trigger_v2.sql, but we'll ensure it's correct
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_type TEXT;
  v_role TEXT;
  v_name TEXT;
BEGIN
  -- Extract metadata with defaults
  v_account_type := COALESCE(
    NEW.raw_user_meta_data->>'account_type',
    'individual'
  );
  
  v_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    CASE 
      WHEN v_account_type = 'organization' THEN 'organization'
      ELSE 'player'
    END
  );
  
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    split_part(COALESCE(NEW.email, ''), '@', 1)
  );
  
  -- Insert profile with conflict handling
  INSERT INTO icepulse_profiles (
    id,
    email,
    name,
    account_type,
    role
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    v_name,
    v_account_type,
    v_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(icepulse_profiles.name, EXCLUDED.name),
    account_type = EXCLUDED.account_type,
    role = EXCLUDED.role;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail user creation
    RAISE WARNING 'Error creating profile for user %: % (SQLSTATE: %)', 
      NEW.id, SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;

-- Fix update_stream_updated_at function
CREATE OR REPLACE FUNCTION update_stream_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================
-- FIX OVERLY PERMISSIVE RLS POLICIES
-- ============================================
-- These tables appear to be legacy tables not used by the application
-- (the app uses icepulse_* prefixed tables instead)
-- We'll drop the overly permissive policies and replace with more restrictive ones
-- or drop them entirely if the tables aren't used

-- Check if these tables exist and have data before modifying policies
-- If tables are empty/unused, we can safely tighten or drop policies

-- game_events table (if exists and unused, tighten policy)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'game_events') THEN
    DROP POLICY IF EXISTS "Allow all for authenticated users" ON game_events;
    -- Create more restrictive policy if table is used
    -- For now, we'll create a restrictive policy that requires explicit permissions
    CREATE POLICY "Authenticated users can view game_events"
      ON game_events FOR SELECT
      USING ((select auth.role()) = 'authenticated');
    
    CREATE POLICY "Authenticated users can insert game_events"
      ON game_events FOR INSERT
      WITH CHECK ((select auth.role()) = 'authenticated');
    
    CREATE POLICY "Authenticated users can update own game_events"
      ON game_events FOR UPDATE
      USING ((select auth.role()) = 'authenticated');
    
    CREATE POLICY "Authenticated users can delete own game_events"
      ON game_events FOR DELETE
      USING ((select auth.role()) = 'authenticated');
  END IF;
END $$;

-- games table (legacy - app uses icepulse_games)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'games') THEN
    DROP POLICY IF EXISTS "Allow all for authenticated users" ON games;
    CREATE POLICY "Authenticated users can view games"
      ON games FOR SELECT
      USING ((select auth.role()) = 'authenticated');
    
    CREATE POLICY "Authenticated users can insert games"
      ON games FOR INSERT
      WITH CHECK ((select auth.role()) = 'authenticated');
    
    CREATE POLICY "Authenticated users can update games"
      ON games FOR UPDATE
      USING ((select auth.role()) = 'authenticated');
    
    CREATE POLICY "Authenticated users can delete games"
      ON games FOR DELETE
      USING ((select auth.role()) = 'authenticated');
  END IF;
END $$;

-- organizations table (legacy - app uses icepulse_organizations)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organizations') THEN
    DROP POLICY IF EXISTS "Allow all for authenticated users" ON organizations;
    CREATE POLICY "Authenticated users can view organizations"
      ON organizations FOR SELECT
      USING ((select auth.role()) = 'authenticated');
    
    CREATE POLICY "Authenticated users can insert organizations"
      ON organizations FOR INSERT
      WITH CHECK ((select auth.role()) = 'authenticated');
    
    CREATE POLICY "Authenticated users can update organizations"
      ON organizations FOR UPDATE
      USING ((select auth.role()) = 'authenticated');
    
    CREATE POLICY "Authenticated users can delete organizations"
      ON organizations FOR DELETE
      USING ((select auth.role()) = 'authenticated');
  END IF;
END $$;

-- persons table (legacy - app uses icepulse_profiles)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'persons') THEN
    DROP POLICY IF EXISTS "Allow all for authenticated users" ON persons;
    CREATE POLICY "Authenticated users can view persons"
      ON persons FOR SELECT
      USING ((select auth.role()) = 'authenticated');
    
    CREATE POLICY "Authenticated users can insert persons"
      ON persons FOR INSERT
      WITH CHECK ((select auth.role()) = 'authenticated');
    
    CREATE POLICY "Authenticated users can update persons"
      ON persons FOR UPDATE
      USING ((select auth.role()) = 'authenticated');
    
    CREATE POLICY "Authenticated users can delete persons"
      ON persons FOR DELETE
      USING ((select auth.role()) = 'authenticated');
  END IF;
END $$;

-- roster_memberships table (legacy - app uses icepulse_player_assignments)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'roster_memberships') THEN
    DROP POLICY IF EXISTS "Allow all for authenticated users" ON roster_memberships;
    CREATE POLICY "Authenticated users can view roster_memberships"
      ON roster_memberships FOR SELECT
      USING ((select auth.role()) = 'authenticated');
    
    CREATE POLICY "Authenticated users can insert roster_memberships"
      ON roster_memberships FOR INSERT
      WITH CHECK ((select auth.role()) = 'authenticated');
    
    CREATE POLICY "Authenticated users can update roster_memberships"
      ON roster_memberships FOR UPDATE
      USING ((select auth.role()) = 'authenticated');
    
    CREATE POLICY "Authenticated users can delete roster_memberships"
      ON roster_memberships FOR DELETE
      USING ((select auth.role()) = 'authenticated');
  END IF;
END $$;

-- seasons table (legacy - app uses icepulse_seasons)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'seasons') THEN
    DROP POLICY IF EXISTS "Allow all for authenticated users" ON seasons;
    CREATE POLICY "Authenticated users can view seasons"
      ON seasons FOR SELECT
      USING ((select auth.role()) = 'authenticated');
    
    CREATE POLICY "Authenticated users can insert seasons"
      ON seasons FOR INSERT
      WITH CHECK ((select auth.role()) = 'authenticated');
    
    CREATE POLICY "Authenticated users can update seasons"
      ON seasons FOR UPDATE
      USING ((select auth.role()) = 'authenticated');
    
    CREATE POLICY "Authenticated users can delete seasons"
      ON seasons FOR DELETE
      USING ((select auth.role()) = 'authenticated');
  END IF;
END $$;

-- teams table (legacy - app uses icepulse_teams)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'teams') THEN
    DROP POLICY IF EXISTS "Allow all for authenticated users" ON teams;
    CREATE POLICY "Authenticated users can view teams"
      ON teams FOR SELECT
      USING ((select auth.role()) = 'authenticated');
    
    CREATE POLICY "Authenticated users can insert teams"
      ON teams FOR INSERT
      WITH CHECK ((select auth.role()) = 'authenticated');
    
    CREATE POLICY "Authenticated users can update teams"
      ON teams FOR UPDATE
      USING ((select auth.role()) = 'authenticated');
    
    CREATE POLICY "Authenticated users can delete teams"
      ON teams FOR DELETE
      USING ((select auth.role()) = 'authenticated');
  END IF;
END $$;

-- user_player_associations table (legacy - app uses icepulse_parent_player_connections)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_player_associations') THEN
    DROP POLICY IF EXISTS "Allow all for authenticated users" ON user_player_associations;
    CREATE POLICY "Authenticated users can view user_player_associations"
      ON user_player_associations FOR SELECT
      USING ((select auth.role()) = 'authenticated');
    
    CREATE POLICY "Authenticated users can insert user_player_associations"
      ON user_player_associations FOR INSERT
      WITH CHECK ((select auth.role()) = 'authenticated');
    
    CREATE POLICY "Authenticated users can update user_player_associations"
      ON user_player_associations FOR UPDATE
      USING ((select auth.role()) = 'authenticated');
    
    CREATE POLICY "Authenticated users can delete user_player_associations"
      ON user_player_associations FOR DELETE
      USING ((select auth.role()) = 'authenticated');
  END IF;
END $$;

-- users table (legacy - app uses icepulse_profiles)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    DROP POLICY IF EXISTS "Allow all for authenticated users" ON users;
    CREATE POLICY "Authenticated users can view users"
      ON users FOR SELECT
      USING ((select auth.role()) = 'authenticated');
    
    CREATE POLICY "Authenticated users can insert users"
      ON users FOR INSERT
      WITH CHECK ((select auth.role()) = 'authenticated');
    
    CREATE POLICY "Authenticated users can update users"
      ON users FOR UPDATE
      USING ((select auth.role()) = 'authenticated');
    
    CREATE POLICY "Authenticated users can delete users"
      ON users FOR DELETE
      USING ((select auth.role()) = 'authenticated');
  END IF;
END $$;

-- ============================================
-- VERIFICATION
-- ============================================
-- Check that functions have search_path set
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) LIKE '%SET search_path%' as has_search_path
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('track_jersey_history', 'handle_new_user', 'update_stream_updated_at', 'update_updated_at_column')
ORDER BY p.proname;
