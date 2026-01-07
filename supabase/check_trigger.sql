-- Check if trigger is working correctly
-- Run this to diagnose profile creation issues

-- Check if trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Check if function exists
SELECT 
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_name = 'handle_new_user';

-- Test the function manually (replace with actual user ID)
-- SELECT handle_new_user();

-- Check recent profiles
SELECT 
  id,
  email,
  name,
  account_type,
  role,
  created_at
FROM icepulse_profiles
ORDER BY created_at DESC
LIMIT 10;

-- Check recent auth users
SELECT 
  id,
  email,
  created_at,
  raw_user_meta_data
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;
