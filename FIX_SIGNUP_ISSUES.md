# Fix Signup Issues

## Issues Found:
1. **Missing Service Role Key** - Required for admin fallback
2. **Infinite Recursion in RLS Policy** - `icepulse_organizations` policy causing 500 errors
3. **Console Stream Export Error** - Fixed

## Steps to Fix:

### 1. Add Service Role Key to `.env`

Add this line to your `.env` file:
```env
VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

To get your service role key:
1. Go to your Supabase Dashboard
2. Settings → API
3. Copy the `service_role` key (⚠️ Keep this secret!)
4. Add it to your `.env` file

### 2. Fix RLS Policies (Run in Supabase SQL Editor)

Run the SQL script: `supabase/fix_rls_v3.sql`

This will:
- Drop problematic policies causing infinite recursion
- Create simplified policies that avoid recursion
- Ensure users can view/insert/update their own profiles

### 3. Verify Trigger (Optional but Recommended)

Run the SQL script: `supabase/verify_trigger.sql`

This will:
- Check if the trigger exists
- Create it if missing
- Show recent users and their profiles

## After Fixing:

1. **Restart your dev server** (to pick up the new `.env` variable)
2. **Try creating an organizational account again**
3. The system should now:
   - Wait for the trigger to create the profile
   - Use admin client as fallback if trigger fails
   - Show clear error messages if something is still wrong

## What Was Fixed:

- ✅ Console stream export error
- ✅ Admin client error handling (won't throw if key missing)
- ✅ RLS policy fix script created (`fix_rls_v3.sql`)

## Still Need To Do:

- ⚠️ Add `VITE_SUPABASE_SERVICE_ROLE_KEY` to `.env`
- ⚠️ Run `supabase/fix_rls_v3.sql` in Supabase SQL Editor
- ⚠️ Restart dev server
