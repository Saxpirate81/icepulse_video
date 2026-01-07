-- Manually confirm a user account (if email confirmation is enabled)
-- Replace 'user-email@example.com' with the actual email address

-- This will mark the user as confirmed so they can log in
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'user-email@example.com';

-- Verify the user is confirmed
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at
FROM auth.users
WHERE email = 'user-email@example.com';
