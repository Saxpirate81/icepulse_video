-- Verify and fix trigger for profile creation
-- Run this to check if trigger is working and fix if needed

-- 1. Check if trigger exists
SELECT 
  'Trigger Status' as check_type,
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- 2. Check if function exists
SELECT 
  'Function Status' as check_type,
  routine_name,
  routine_type,
  security_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_name = 'handle_new_user';

-- 3. Check recent users and their profiles
SELECT 
  'Recent Users' as check_type,
  u.id as user_id,
  u.email,
  u.created_at as user_created,
  p.id as profile_id,
  p.account_type,
  p.role,
  p.created_at as profile_created,
  CASE 
    WHEN p.id IS NULL THEN '❌ Missing Profile'
    ELSE '✅ Profile Exists'
  END as status
FROM auth.users u
LEFT JOIN icepulse_profiles p ON u.id = p.id
ORDER BY u.created_at DESC
LIMIT 10;

-- 4. If trigger doesn't exist, create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'on_auth_user_created'
  ) THEN
    RAISE NOTICE 'Trigger does not exist. Creating...';
    
    -- Create function
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
      
      INSERT INTO icepulse_profiles (
        id, email, name, account_type, role
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
        RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
    END;
    $$;
    
    -- Create trigger
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION handle_new_user();
    
    RAISE NOTICE 'Trigger created successfully!';
  ELSE
    RAISE NOTICE 'Trigger already exists.';
  END IF;
END $$;
