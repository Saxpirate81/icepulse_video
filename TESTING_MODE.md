# Testing Mode - Auto Account Creation

## Overview

For testing purposes, the invite system now automatically creates auth accounts with a generic password when you send an invite to a player, coach, or parent.

## How It Works

When you click "Send Invite" for a player, coach, or parent:

1. ✅ **Checks if an auth account already exists** for that email address
2. ✅ **If no account exists**, automatically creates one with:
   - Email: The email address from the player/coach/parent record
   - Password: `password` (generic password for testing)
   - Email confirmation: Auto-confirmed (no email verification needed)
   - Role: Automatically set based on type (player/coach/parent)
3. ✅ **Waits for database triggers** to create the profile and link it to the record
4. ✅ **Marks the invite as sent** in the database

## Login Credentials

All test accounts created this way use:
- **Email**: The email address you entered for the player/coach/parent
- **Password**: `password`

## Example

1. Add a player with email: `bill.doss+3@example.com`
2. Click "Send Invite"
3. The system automatically creates an auth account
4. You can immediately log in with:
   - Email: `bill.doss+3@example.com`
   - Password: `password`

## Console Logging

Check your browser console (F12 → Console) to see detailed logs:
- `[sendPlayerInvite]` - For player invites
- `[sendCoachInvite]` - For coach invites
- `[sendParentInvite]` - For parent invites

You'll see:
- When the account creation starts
- Whether an account already existed
- When the account is created successfully
- The login credentials

## Important Notes

⚠️ **This is for TESTING ONLY!**

- The password "password" is hardcoded and not secure
- All accounts are auto-confirmed (no email verification)
- This should be removed or made configurable before production

## Disabling Testing Mode

To disable auto-account creation, you would need to:
1. Remove or comment out the account creation code in:
   - `sendPlayerInvite()` in `src/context/OrgContext.jsx`
   - `sendCoachInvite()` in `src/context/OrgContext.jsx`
   - `sendParentInvite()` in `src/context/OrgContext.jsx`

Or make it conditional based on an environment variable:
```javascript
const TESTING_MODE = import.meta.env.VITE_TESTING_MODE === 'true'
if (TESTING_MODE && adminClient) {
  // ... account creation code ...
}
```

## Requirements

This feature requires:
- `VITE_SUPABASE_SERVICE_ROLE_KEY` to be set in your `.env` file
- The admin client must be available (see `src/lib/supabase-admin.js`)

If the admin client is not available, the system will:
- Still mark the invite as sent
- Log a warning that auto-account creation was skipped
- Continue normally (you'll just need to create accounts manually)
