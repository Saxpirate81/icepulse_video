-- Migration to automatically link new user signups to existing player/coach/parent records
-- When a user signs up with an email that matches an existing player/coach/parent record,
-- this trigger will automatically link them by setting the profile_id field.

-- ============================================
-- FUNCTION TO LINK EXISTING RECORDS
-- ============================================

CREATE OR REPLACE FUNCTION link_existing_user_records()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_email TEXT;
  v_user_id UUID;
  v_user_role TEXT;
BEGIN
  -- Get the new profile's email and ID
  v_user_email := LOWER(NEW.email);
  v_user_id := NEW.id;
  v_user_role := NEW.role;

  -- Only proceed if email is not empty
  IF v_user_email IS NULL OR v_user_email = '' THEN
    RETURN NEW;
  END IF;

  -- Link to Players (case-insensitive email match)
  UPDATE icepulse_players
  SET 
    profile_id = v_user_id,
    is_existing_user = TRUE
  WHERE 
    LOWER(email) = v_user_email
    AND profile_id IS NULL  -- Only link if not already linked
    AND (
      -- Link if role is 'player' or if no specific role requirement
      v_user_role = 'player' OR v_user_role IS NULL
    );

  -- Link to Coaches (case-insensitive email match)
  UPDATE icepulse_coaches
  SET 
    profile_id = v_user_id,
    is_existing_user = TRUE
  WHERE 
    LOWER(email) = v_user_email
    AND profile_id IS NULL  -- Only link if not already linked
    AND (
      -- Link if role is 'coach' or if no specific role requirement
      v_user_role = 'coach' OR v_user_role IS NULL
    );

  -- Link to Parents (case-insensitive email match)
  UPDATE icepulse_parents
  SET 
    profile_id = v_user_id,
    is_existing_user = TRUE
  WHERE 
    LOWER(email) = v_user_email
    AND profile_id IS NULL  -- Only link if not already linked
    AND (
      -- Link if role is 'parent' or if no specific role requirement
      v_user_role = 'parent' OR v_user_role IS NULL
    );

  RETURN NEW;
END;
$$;

-- ============================================
-- TRIGGER TO RUN AFTER PROFILE CREATION
-- ============================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_profile_created_link_records ON icepulse_profiles;

-- Create trigger that runs after profile is inserted
CREATE TRIGGER on_profile_created_link_records
  AFTER INSERT ON icepulse_profiles
  FOR EACH ROW
  EXECUTE FUNCTION link_existing_user_records();

-- ============================================
-- FUNCTION TO UPDATE USER ROLE BASED ON LINKED RECORDS
-- ============================================

-- Optional: Function to update user role if they're linked to a player/coach/parent
-- This can be called manually or via another trigger if needed
CREATE OR REPLACE FUNCTION update_user_role_from_linked_records(user_profile_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_has_player BOOLEAN;
  v_has_coach BOOLEAN;
  v_has_parent BOOLEAN;
BEGIN
  -- Check if user is linked to any players
  SELECT EXISTS(SELECT 1 FROM icepulse_players WHERE profile_id = user_profile_id)
  INTO v_has_player;

  -- Check if user is linked to any coaches
  SELECT EXISTS(SELECT 1 FROM icepulse_coaches WHERE profile_id = user_profile_id)
  INTO v_has_coach;

  -- Check if user is linked to any parents
  SELECT EXISTS(SELECT 1 FROM icepulse_parents WHERE profile_id = user_profile_id)
  INTO v_has_parent;

  -- Update role based on what they're linked to (priority: coach > parent > player)
  IF v_has_coach THEN
    UPDATE icepulse_profiles
    SET role = 'coach'
    WHERE id = user_profile_id AND role != 'organization';
  ELSIF v_has_parent THEN
    UPDATE icepulse_profiles
    SET role = 'parent'
    WHERE id = user_profile_id AND role != 'organization';
  ELSIF v_has_player THEN
    UPDATE icepulse_profiles
    SET role = 'player'
    WHERE id = user_profile_id AND role != 'organization';
  END IF;
END;
$$;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON FUNCTION link_existing_user_records IS 
'Automatically links new user signups to existing player/coach/parent records by matching email addresses. 
This allows organizations to add players/coaches/parents with emails, and when those users sign up, 
they are automatically linked to the organization.';

COMMENT ON FUNCTION update_user_role_from_linked_records IS 
'Updates a user''s role based on what records they are linked to. 
Priority: coach > parent > player. Only updates if user is not an organization.';

COMMENT ON TRIGGER on_profile_created_link_records ON icepulse_profiles IS 
'Trigger that runs after a new profile is created. Automatically links the user to any existing 
player/coach/parent records that have the same email address.';

-- ============================================
-- NOTES
-- ============================================
-- This system works as follows:
-- 
-- 1. Organization adds a player/coach/parent with email (e.g., "john@example.com")
--    - Record is created with email but no profile_id
--    - is_existing_user = FALSE
--
-- 2. User signs up on login page with same email ("john@example.com")
--    - Profile is created in icepulse_profiles
--    - Trigger fires and finds matching player/coach/parent record
--    - profile_id is set to the new user's ID
--    - is_existing_user is set to TRUE
--
-- 3. User is now linked to the organization
--    - They can see their player/coach/parent data
--    - They have access based on their role
--
-- Email matching is case-insensitive and works with email aliases (e.g., bill.doss+1@example.com)
