# 🚨 QUICK FIX FOR SIGNUP ISSUES

You're seeing two errors. Here's how to fix them **RIGHT NOW**:

## Error 1: Missing Service Role Key

**The error:** `Admin client not initialized. Please set VITE_SUPABASE_SERVICE_ROLE_KEY in your .env file.`

**Fix:**
1. Open your `.env` file
2. Add this line (get the key from Supabase Dashboard → Settings → API → `service_role` key):
   ```env
   VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```
3. **RESTART YOUR DEV SERVER** (stop it with Ctrl+C and run `npm run dev` again)

## Error 2: Infinite Recursion in RLS Policy

**The error:** `infinite recursion detected in policy for relation "icepulse_organizations"`

**Fix:**
1. Go to your **Supabase Dashboard**
2. Click **"SQL Editor"** in the sidebar
3. Open the file `supabase/fix_rls_aggressive.sql` from this project
4. **Copy the entire contents** of that file
5. **Paste it into the SQL Editor**
6. Click **"Run"** (or press Cmd+Enter)
7. Wait for it to complete (should take 1-2 seconds)

## After Both Fixes:

1. **Restart your dev server** (if you haven't already)
2. **Try creating an organizational account again**
3. It should work now! ✅

## What These Fixes Do:

- **Service Role Key**: Allows the admin client to create profiles as a fallback if the trigger fails
- **RLS Fix**: Removes the infinite recursion by simplifying the policies to only allow users to access their own data

## Still Having Issues?

If you're still seeing errors after both fixes:
1. Check the browser console for the exact error message
2. Make sure you restarted the dev server after adding the service role key
3. Verify the SQL script ran successfully in Supabase (check for any error messages)
