# Disable Email Confirmation in Supabase

## Quick Fix for Development

To disable email confirmation so you can log in immediately after signup:

1. **Go to your Supabase Dashboard**
2. **Navigate to:** Authentication → Settings
3. **Scroll down to:** "Auth Providers" section
4. **Find:** "Enable email confirmations" toggle
5. **Turn it OFF** (disable it)
6. **Save changes**

## Alternative: Check Email Settings

If you want to keep email confirmations enabled but fix the email sending:

1. **Go to:** Settings → Auth → Email Templates
2. **Check:** "Confirm signup" template exists
3. **Go to:** Settings → Auth → SMTP Settings
4. **Configure SMTP** (or use Supabase's default email service)

## After Disabling Email Confirmations:

1. **Try logging in again** with the credentials you created
2. It should work immediately without needing email confirmation

## Note:

- Disabling email confirmations is fine for development
- For production, you should enable it and configure proper SMTP
- Users created before disabling will still need to be confirmed (you can manually confirm them in the Supabase dashboard)
