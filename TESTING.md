# Testing the UI Without Backend

## Current Behavior

The app currently uses **localStorage** to simulate authentication. This allows you to test the full UI flow without a backend.

## How to Test

### 1. **Create Account Flow**
- Click "Don't have an account? Sign up"
- Select account type (Individual or Organization)
- Enter email and password
- Click "Create Account"
- ✅ You'll be automatically logged in and see the VideoRecorder

### 2. **Login Flow**
- Enter email and password
- Click "Sign In"
- ✅ You'll be logged in and see the VideoRecorder

### 3. **Logout Flow**
- Click the account button (top right)
- Click "Logout"
- ✅ Logo flashes, then returns to login screen

### 4. **Reset Testing State**

To clear all data and start fresh:

**Option A: Browser DevTools**
1. Open DevTools (F12 or Cmd+Option+I)
2. Go to Application/Storage tab
3. Click "Local Storage" → `http://localhost:5173`
4. Delete the `user` key
5. Refresh the page

**Option B: Browser Console**
```javascript
localStorage.removeItem('user')
location.reload()
```

**Option C: Clear All Browser Data**
- Settings → Clear browsing data → Local storage

## What Gets Saved

Currently saved to localStorage:
```json
{
  "email": "user@example.com",
  "name": "user",
  "type": "individual" // or "organization"
}
```

## Testing Different Scenarios

1. **Test Individual Account**: Select "Individual" during signup
2. **Test Organization Account**: Select "Organization" during signup
3. **Test Password Validation**: Try passwords less than 8 characters
4. **Test Password Match**: Enter different passwords in confirm field
5. **Test Forgot Password**: Click "Forgot password?" link
6. **Test Account Menu**: Click account button to see user info and logout

## When You're Ready for Backend

Replace the functions in `src/context/AuthContext.jsx`:
- `login()` - Make API call to your auth endpoint
- `signup()` - Make API call to create user
- `resetPassword()` - Make API call to send reset email

The UI is already set up to handle success/error responses!
