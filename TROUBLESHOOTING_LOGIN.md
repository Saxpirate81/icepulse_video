# Troubleshooting Login Issues

## Problem: Can't log in with newly created player account

If you're getting "Invalid email or password" when trying to log in with a player account that was just created:

## Step 1: Check Console Logs

When you click "Send Invite" for a player, check your browser console (F12 → Console). You should see detailed logs like:

```
[sendPlayerInvite] Starting invite process for playerId: ...
[sendPlayerInvite] Player found: { id: ..., name: ..., email: ... }
[sendPlayerInvite] Creating auth account for testing...
[sendPlayerInvite] Email (normalized): bill.doss+3@example.com
[sendPlayerInvite] Checking for existing user...
[sendPlayerInvite] ✅ Auth account created successfully: { id: ..., email: ..., confirmed: Yes }
[sendPlayerInvite] ✅ Account verified: { id: ..., email: ..., canLogin: Yes }
[sendPlayerInvite] ✅ Account setup complete. Login credentials: { email: ..., password: password }
```

**Look for:**
- ✅ Success messages - account was created
- ❌ Error messages - account creation failed
- ⚠️ Warnings - something might be wrong

## Step 2: Verify Account Was Created

### Option A: Use the Check Script

Run this command in your terminal:

```bash
node scripts/check-player-account.js bill.doss+3@example.com
```

Replace `bill.doss+3@example.com` with the actual email you used.

This will show you:
- Whether the account exists
- If email is confirmed
- The account ID
- Profile information
- Player record information

### Option B: Check Supabase Dashboard

1. Go to your Supabase dashboard
2. Navigate to **Authentication** → **Users**
3. Search for the email address
4. Check if:
   - The account exists
   - Email is confirmed (green checkmark)
   - The account was created recently

## Step 3: Common Issues

### Issue 1: Email Not Confirmed

**Symptom:** Account exists but login fails with "Email not confirmed"

**Solution:** The account should be auto-confirmed, but if not:
1. In Supabase dashboard → Authentication → Users
2. Find the user
3. Click "Confirm Email" button

### Issue 2: Email Case Mismatch

**Symptom:** Account exists but login fails

**Solution:** The system now normalizes emails (lowercase, trimmed). Make sure you're using the exact email:
- Check for extra spaces
- Check for case differences
- The console logs will show the normalized email

### Issue 3: Admin Client Not Available

**Symptom:** Console shows "Admin client not available"

**Solution:** 
1. Check your `.env` file has `VITE_SUPABASE_SERVICE_ROLE_KEY`
2. Restart your dev server after adding it
3. The service role key is different from the anon key

### Issue 4: Account Creation Failed Silently

**Symptom:** No error but account doesn't exist

**Solution:**
1. Check console for error messages
2. Verify `VITE_SUPABASE_SERVICE_ROLE_KEY` is correct
3. Check Supabase dashboard for any errors
4. Try creating the account manually in Supabase dashboard

## Step 4: Manual Account Creation (Fallback)

If automatic account creation isn't working:

1. Go to Supabase dashboard → Authentication → Users
2. Click "Add User" → "Create new user"
3. Enter:
   - Email: The player's email
   - Password: `password`
   - Auto Confirm User: ✅ (check this)
4. Click "Create User"
5. The profile should be created automatically by the trigger
6. Try logging in again

## Step 5: Verify Login Credentials

When logging in, make sure:
- **Email:** Exactly as stored (check console logs for normalized version)
- **Password:** `password` (lowercase, no quotes)

The login function now normalizes the email automatically, but double-check:
- No extra spaces before/after
- Correct case (though it's normalized)
- Exact email address

## Debugging Tips

1. **Check Browser Console** - All account creation steps are logged
2. **Check Network Tab** - Look for failed API calls to `/auth/v1/token`
3. **Check Supabase Logs** - Go to Logs → API in Supabase dashboard
4. **Use the Check Script** - Run `node scripts/check-player-account.js <email>` to verify account exists

## Still Having Issues?

If none of the above works:

1. **Check the exact error message** in the browser console
2. **Verify the email** - Use the check script to see what email is actually stored
3. **Check Supabase Auth settings** - Make sure email confirmation is disabled for testing
4. **Try creating account manually** in Supabase dashboard
5. **Check RLS policies** - Make sure profiles table allows reading

## Quick Test

1. Send invite to a player with email: `test@example.com`
2. Check console for success messages
3. Run: `node scripts/check-player-account.js test@example.com`
4. Try logging in with:
   - Email: `test@example.com`
   - Password: `password`

If this works, the system is working correctly. If not, check the error messages in the console and Supabase dashboard.
