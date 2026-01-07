# Supabase Admin Utilities

This document explains how to use the admin utilities for troubleshooting Supabase issues.

## ⚠️ Security Warning

The admin utilities use the **SERVICE ROLE KEY** which bypasses Row Level Security (RLS). 

**NEVER:**
- Import `supabase-admin.js` in frontend components
- Commit the service role key to git
- Use admin functions in production frontend code

## Setup

Add your service role key to `.env`:

```env
VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**Important:** The service role key should be kept secret and never exposed in frontend code. These utilities are for development and troubleshooting only.

## Usage

### In Browser Console (for debugging)

1. Open your browser's developer console
2. Import the troubleshooting functions:

```javascript
// In browser console
const { runDiagnostics, checkUserProfile } = await import('/src/utils/supabase-troubleshoot.js')
```

3. Run diagnostics:

```javascript
await runDiagnostics()
```

4. Check a specific user:

```javascript
await checkUserProfile('user-id-here')
```

### Available Functions

- `testAdminConnection()` - Test if admin client can connect
- `checkUserProfile(userId)` - Check if a user profile exists
- `getAllProfiles()` - Get all user profiles (admin only)
- `createProfileManually(profileData)` - Manually create a profile if trigger failed
- `checkTableExists(tableName)` - Verify a table exists
- `runDiagnostics()` - Run all diagnostic checks

## Troubleshooting Common Issues

### Profile Not Created After Signup

```javascript
import { checkUserProfile, createProfileManually } from './utils/supabase-troubleshoot'

// Check if profile exists
const result = await checkUserProfile('user-id-from-auth')
console.log(result)

// If missing, create manually
if (!result.data) {
  await createProfileManually({
    id: 'user-id',
    email: 'user@example.com',
    name: 'User Name',
    account_type: 'individual',
    role: 'player'
  })
}
```

### Check Database Tables

```javascript
import { checkTableExists } from './utils/supabase-troubleshoot'

await checkTableExists('icepulse_profiles')
await checkTableExists('icepulse_organizations')
```

## Notes

- These utilities are for development/troubleshooting only
- The service role key bypasses all RLS policies
- Use with caution and only in development environments
