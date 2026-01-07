# Testing Toggles Feature

## Overview

The app includes testing toggles that allow you to switch between different user views and users for testing purposes. These work in both **mock mode** and **real database mode**.

## Components

### 1. View Toggle
- **Location**: Top right, before Account Menu
- **Shows**: Organization, Coach, Player, Parent views
- **Function**: Switches the entire app view based on user role

### 2. User Selector
- **Location**: Between View Toggle and Account Menu
- **Shows**: Dynamic list based on current view
  - **Player view**: List of all players
  - **Parent view**: List of all parents
  - **Coach view**: List of all coaches
- **Function**: Switches to a specific user to see their data

## Enabling Testing Toggles

### Option 1: Mock Mode (Current)
```env
VITE_USE_MOCK_DATA=true
```
Toggles automatically enabled in mock mode.

### Option 2: Real Database (After Database is Fixed)
```env
VITE_ENABLE_TESTING_TOGGLES=true
```
This enables toggles even when using the real database.

## How It Works

### View Toggle
1. Click to see all 4 role options
2. Select a role (Organization/Coach/Player/Parent)
3. Role saved to `localStorage` as `mock_user_role`
4. Page reloads with that role's view

### User Selector
1. Only appears for Player/Parent/Coach views
2. Shows list of all users in that role
3. Click a user to switch to their account
4. User ID saved to `localStorage` as `mock_player_id` / `mock_parent_id` / `mock_coach_id`
5. Page reloads showing that user's data

## Data Flow

### Mock Mode
- Uses `mock-data.js` for all data
- 15 players, 15 parents, 3 coaches
- All connected properly

### Real Database Mode (When Enabled)
- Fetches real users from database
- Uses `organization.players`, `organization.parents`, `organization.coaches`
- Shows actual user data from Supabase

## Testing Scenarios

### Test Player View
1. Click View Toggle → Select "Player"
2. Click User Selector → Choose a player (e.g., "James Anderson")
3. See that player's dashboard with their stats, teams, etc.

### Test Parent View
1. Click View Toggle → Select "Parent"
2. Click User Selector → Choose a parent (e.g., "Robert Anderson")
3. See that parent's view with their connected players

### Test Coach View
1. Click View Toggle → Select "Coach"
2. Click User Selector → Choose a coach (e.g., "Robert Thompson")
3. See that coach's team management view

## localStorage Keys

- `mock_user_role` - Current role (organization/coach/player/parent)
- `mock_player_id` - Selected player ID (mock mode)
- `mock_parent_id` - Selected parent ID (mock mode)
- `mock_coach_id` - Selected coach ID (mock mode)
- `test_player_id` - Selected player ID (real database mode)
- `test_parent_id` - Selected parent ID (real database mode)
- `test_coach_id` - Selected coach ID (real database mode)

## After Database is Fixed

Once Supabase is working again:

1. **Keep mock mode off** (or set `VITE_USE_MOCK_DATA=false`)
2. **Enable testing toggles**: Add `VITE_ENABLE_TESTING_TOGGLES=true` to `.env`
3. **Toggles will work with real data**:
   - View Toggle will switch between real user roles
   - User Selector will show real players/parents/coaches from database
   - You can test what each user sees with real data

## Benefits

- ✅ Test all user views without logging in/out
- ✅ See what each individual user sees
- ✅ Verify data permissions and RLS policies
- ✅ Test UI for different user types
- ✅ Quick switching for development

---

**Note**: These toggles are for **testing/development only**. They should be disabled in production by not setting the environment variables.
