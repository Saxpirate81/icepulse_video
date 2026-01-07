-- Enhanced trigger fix with better error handling and logging

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Recreate function with comprehensive error handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
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

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Verify trigger is created
SELECT 
  'Trigger created successfully' as status,
  trigger_name,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
