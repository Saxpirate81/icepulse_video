-- Migration to support parent email login for players and email aliases
-- This allows players to log in using their parent's email address

-- ============================================
-- HELPER FUNCTIONS FOR PARENT-PLAYER LOGIN
-- ============================================

-- Function to find player records accessible by a user
-- Checks both:
-- 1. Direct profile_id link (player has their own account)
-- 2. Parent email match (player uses parent's email for login)
CREATE OR REPLACE FUNCTION get_accessible_players(user_profile_id UUID, user_email TEXT)
RETURNS TABLE (
  player_id UUID,
  player_full_name TEXT,
  player_email TEXT,
  access_type TEXT -- 'own_account' or 'parent_email'
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  -- Players with their own account (profile_id matches)
  SELECT 
    p.id AS player_id,
    p.full_name AS player_full_name,
    p.email AS player_email,
    'own_account'::TEXT AS access_type
  FROM icepulse_players p
  WHERE p.profile_id = user_profile_id
  
  UNION
  
  -- Players accessible via parent email (parent's email matches user email)
  SELECT DISTINCT
    p.id AS player_id,
    p.full_name AS player_full_name,
    p.email AS player_email,
    'parent_email'::TEXT AS access_type
  FROM icepulse_players p
  INNER JOIN icepulse_parent_player_connections ppc ON ppc.player_id = p.id
  INNER JOIN icepulse_parents par ON par.id = ppc.parent_id
  WHERE LOWER(par.email) = LOWER(user_email)
    AND par.email IS NOT NULL
    AND par.email != '';
END;
$$;

-- Function to find parent records accessible by a user
CREATE OR REPLACE FUNCTION get_accessible_parents(user_profile_id UUID, user_email TEXT)
RETURNS TABLE (
  parent_id UUID,
  parent_full_name TEXT,
  parent_email TEXT,
  access_type TEXT -- 'own_account' or 'email_match'
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  -- Parents with their own account (profile_id matches)
  SELECT 
    par.id AS parent_id,
    par.full_name AS parent_full_name,
    par.email AS parent_email,
    'own_account'::TEXT AS access_type
  FROM icepulse_parents par
  WHERE par.profile_id = user_profile_id
  
  UNION
  
  -- Parents accessible via email match (parent email matches user email)
  SELECT 
    par.id AS parent_id,
    par.full_name AS parent_full_name,
    par.email AS parent_email,
    'email_match'::TEXT AS access_type
  FROM icepulse_parents par
  WHERE LOWER(par.email) = LOWER(user_email)
    AND par.email IS NOT NULL
    AND par.email != ''
    AND (par.profile_id IS NULL OR par.profile_id != user_profile_id);
END;
$$;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Index on parent email for faster lookups
CREATE INDEX IF NOT EXISTS idx_icepulse_parents_email_lower 
ON icepulse_parents(LOWER(email)) 
WHERE email IS NOT NULL AND email != '';

-- Index on player email for faster lookups
CREATE INDEX IF NOT EXISTS idx_icepulse_players_email_lower 
ON icepulse_players(LOWER(email)) 
WHERE email IS NOT NULL AND email != '';

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON FUNCTION get_accessible_players IS 
'Returns all player records accessible by a user. Checks both direct profile_id links and parent email matches. This allows players to log in using their parent''s email address.';

COMMENT ON FUNCTION get_accessible_parents IS 
'Returns all parent records accessible by a user. Checks both direct profile_id links and email matches.';

COMMENT ON INDEX idx_icepulse_parents_email_lower IS 
'Index for fast parent email lookups (case-insensitive). Used when players log in with parent email.';

COMMENT ON INDEX idx_icepulse_players_email_lower IS 
'Index for fast player email lookups (case-insensitive).';

-- ============================================
-- NOTES ON EMAIL ALIASES
-- ============================================
-- Email aliases (e.g., bill.doss+1@example.com, bill.doss+2@example.com) 
-- are automatically supported by Supabase Auth. Each alias is treated as 
-- a unique email address, so you can create multiple test accounts:
-- 
-- - bill.doss@example.com (main account)
-- - bill.doss+1@example.com (test account 1)
-- - bill.doss+2@example.com (test account 2)
-- - bill.doss+parent@example.com (parent account)
-- - bill.doss+player@example.com (player account)
--
-- All emails will be delivered to bill.doss@example.com, but Supabase
-- treats them as separate accounts for authentication purposes.
--
-- The functions above use LOWER() for case-insensitive email matching,
-- which also works correctly with email aliases.
