# Automatic User Linking System

## Overview

When an organization adds a player, coach, or parent with an email address, and that person later creates an account on the login page, the system automatically links them to the organization.

## How It Works

### 1. Organization Adds User with Email
- Organization admin adds a player/coach/parent with email (e.g., `john@example.com`)
- Record is created in `icepulse_players`, `icepulse_coaches`, or `icepulse_parents`
- `profile_id` is `NULL` (no account yet)
- `is_existing_user` is `FALSE`

### 2. User Signs Up
- User goes to login page and clicks "Sign Up"
- Enters the same email (`john@example.com`) and creates account
- Profile is created in `icepulse_profiles`
- **Database trigger automatically runs** (`on_profile_created_link_records`)

### 3. Automatic Linking
- Trigger searches for player/coach/parent records with matching email (case-insensitive)
- If found, sets `profile_id` to the new user's ID
- Sets `is_existing_user` to `TRUE`
- User is now linked to the organization

### 4. User Access
- When user logs in, they see their player/coach/parent data
- They have access based on their role (player, coach, or parent)
- They can see their team assignments, stats, etc.

## Database Trigger

The trigger `on_profile_created_link_records` runs automatically after a new profile is created. It:

1. **Matches by email** (case-insensitive)
2. **Links players** if user role is 'player' or NULL
3. **Links coaches** if user role is 'coach' or NULL
4. **Links parents** if user role is 'parent' or NULL
5. **Only links if not already linked** (`profile_id IS NULL`)

## Email Aliases Support

Email aliases work perfectly with this system:
- Organization adds: `bill.doss+player@example.com`
- User signs up with: `bill.doss+player@example.com`
- System matches and links automatically

## Role Assignment

The system respects the user's role when linking:
- If user signs up as "player", they'll be linked to player records
- If user signs up as "coach", they'll be linked to coach records
- If user signs up as "parent", they'll be linked to parent records
- If role is NULL or doesn't match, it will still link (allows flexibility)

## Manual Role Update

If you need to update a user's role after they're linked, you can use the function:

```sql
SELECT update_user_role_from_linked_records('user-id-here');
```

This will update the user's role based on what records they're linked to (priority: coach > parent > player).

## Setup

To enable this feature, run the SQL migration:

```bash
# In Supabase SQL Editor, run:
supabase/link_existing_users.sql
```

Or use the script:
```bash
node scripts/execute-sql.js supabase/link_existing_users.sql
```

## Example Workflow

1. **Organization Setup:**
   ```
   Organization: "Hockey Club"
   Adds Player: "John Doe", Email: "john@example.com"
   ```

2. **Player Signs Up:**
   ```
   Goes to login page
   Clicks "Sign Up"
   Enters: john@example.com, password
   Account created
   ```

3. **Automatic Linking:**
   ```
   Trigger fires
   Finds player record with email "john@example.com"
   Links: profile_id = new_user_id
   Sets: is_existing_user = TRUE
   ```

4. **Player Logs In:**
   ```
   Sees their player dashboard
   Can view their team assignments
   Can see their stats
   Has access to their organization's data
   ```

## Multiple Organizations

If a user's email appears in multiple organizations:
- The trigger will link them to **all** matching records
- User will see an **organization switcher** in the dashboard (if they're part of 2+ orgs)
- User can switch between organizations to view different data
- This allows players/coaches to be part of multiple organizations

### How It Works:

1. **User is added to multiple organizations:**
   - Organization A adds player "John" with email `john@example.com`
   - Organization B adds coach "John" with email `john@example.com`

2. **User signs up:**
   - User creates account with `john@example.com`
   - Trigger links them to BOTH organizations

3. **User logs in:**
   - Sees organization switcher dropdown (if 2+ orgs)
   - Can switch between Organization A (as player) and Organization B (as coach)
   - Each organization shows only its own data (teams, players, etc.)

### Organization Access:
- **Owner**: Full access to all features (if they created the org)
- **Member**: Access based on role (player/coach/parent)
- **Switching**: Click the organization dropdown to switch between orgs

## Troubleshooting

### User signed up but not linked?
1. Check if email matches exactly (case-insensitive)
2. Verify the player/coach/parent record exists with that email
3. Check if `profile_id` is already set (already linked)
4. Verify the trigger exists: `SELECT * FROM information_schema.triggers WHERE trigger_name = 'on_profile_created_link_records';`

### User linked to wrong role?
- The system links based on the user's role when they sign up
- You can manually update the role in the database
- Or use `update_user_role_from_linked_records()` function

### Email aliases not working?
- Make sure the email in the player/coach/parent record matches exactly
- Email matching is case-insensitive
- Aliases like `bill.doss+1@example.com` work fine
