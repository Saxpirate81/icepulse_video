-- Fix trigger function for user signup
-- Run this if you're getting "Database error saving new user" errors

-- Drop and recreate the trigger function with better error handling
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Recreate the function with error handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Try to insert the profile
  BEGIN
    INSERT INTO icepulse_profiles (id, email, name, account_type, role)
    VALUES (
      NEW.id,
      COALESCE(NEW.email, ''),
      COALESCE(NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email, ''), '@', 1)),
      COALESCE(NEW.raw_user_meta_data->>'account_type', 'individual'),
      COALESCE(NEW.raw_user_meta_data->>'role', 'player')
    )
    ON CONFLICT (id) DO NOTHING; -- Don't fail if profile already exists
  EXCEPTION WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
