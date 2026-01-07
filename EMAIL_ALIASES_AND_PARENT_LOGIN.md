# Email Aliases and Parent-Player Login Support

## Overview

This document explains how email aliases work for testing and how the parent-player login relationship is structured.

## Email Aliases for Testing

Email aliases using the `+` syntax are **automatically supported** by Supabase Auth. You can use the same base email with different aliases to create multiple test accounts:

### Examples:
- `bill.doss@example.com` - Main account
- `bill.doss+1@example.com` - Test account 1
- `bill.doss+2@example.com` - Test account 2
- `bill.doss+parent@example.com` - Parent account
- `bill.doss+player@example.com` - Player account
- `bill.doss+org@example.com` - Organization account

### How It Works:
1. **Supabase treats each alias as a unique email** - You can create separate accounts for each alias
2. **All emails are delivered to the base address** - All emails (including password resets, confirmations) will be delivered to `bill.doss@example.com`
3. **No special configuration needed** - This works out of the box with most email providers (Gmail, Outlook, etc.)

### Usage:
Simply use the aliased email when signing up or logging in:
- Sign up with `bill.doss+1@example.com` → Creates a new account
- Sign up with `bill.doss+2@example.com` → Creates another new account
- Each account is completely independent

## Parent-Player Login Relationship

The system supports two ways for players to access their accounts:

### 1. Players with Their Own Account
- Player has their own email address and profile (`profile_id` is set in `icepulse_players`)
- Player logs in with their own email/password
- Player sees only their own data

### 2. Players Using Parent's Email
- Player doesn't have their own account (no `profile_id`)
- Player is connected to a parent via `icepulse_parent_player_connections`
- When the parent logs in, they see all their connected players
- When a player logs in using the parent's email, they can access their player data

### Database Structure:

```sql
-- Players table has a profile_id field (nullable)
icepulse_players (
  id UUID,
  profile_id UUID REFERENCES icepulse_profiles(id), -- NULL if using parent email
  full_name TEXT,
  email TEXT, -- Player's email (may be same as parent's)
  ...
)

-- Parents table has a profile_id field (nullable)
icepulse_parents (
  id UUID,
  profile_id UUID REFERENCES icepulse_profiles(id), -- Parent's account
  full_name TEXT,
  email TEXT, -- Parent's email
  ...
)

-- Connection table links parents to players
icepulse_parent_player_connections (
  parent_id UUID REFERENCES icepulse_parents(id),
  player_id UUID REFERENCES icepulse_players(id),
  ...
)
```

### How Login Works:

1. **User logs in** with email/password
2. **System checks**:
   - Direct player ownership (`individual_user_id` matches)
   - Player's own account (`profile_id` matches)
   - Parent email match (user's email matches parent's email, and player is connected to that parent)
3. **All accessible players are loaded** and displayed

### Example Scenarios:

#### Scenario 1: Player with Own Account
- Player: "John Doe" with email `john@example.com`
- Player has `profile_id` set to their account
- Player logs in with `john@example.com` → Sees their own data

#### Scenario 2: Player Using Parent Email
- Parent: "Jane Doe" with email `jane@example.com` (has account)
- Player: "John Doe" (no account, `profile_id` is NULL)
- Connection exists between parent and player
- When `jane@example.com` logs in → Sees John's player data
- When `john@example.com` tries to log in → No account exists (would need to create one)

#### Scenario 3: Multiple Players, One Parent
- Parent: "Jane Doe" with email `jane@example.com`
- Player 1: "John Doe" (connected to Jane)
- Player 2: "Sarah Doe" (connected to Jane)
- When `jane@example.com` logs in → Sees both John and Sarah's data

## Database Functions

The system includes helper functions for finding accessible players:

### `get_accessible_players(user_profile_id, user_email)`
Returns all player records accessible by a user, checking:
- Direct `profile_id` links (player has own account)
- Parent email matches (player uses parent's email)

### `get_accessible_parents(user_profile_id, user_email)`
Returns all parent records accessible by a user, checking:
- Direct `profile_id` links (parent has own account)
- Email matches (parent email matches user email)

## Implementation Notes

- Email matching is **case-insensitive** (uses `LOWER()`)
- Email aliases work automatically (no special handling needed)
- The system supports both organizational and individual player accounts
- RLS (Row Level Security) policies ensure users only see data they're allowed to access

## Testing with Email Aliases

To test different account types:

1. **Create Organization Account:**
   ```
   Email: bill.doss+org@example.com
   Account Type: Organization
   ```

2. **Create Parent Account:**
   ```
   Email: bill.doss+parent@example.com
   Account Type: Individual
   Role: Parent
   ```

3. **Create Player Account:**
   ```
   Email: bill.doss+player@example.com
   Account Type: Individual
   Role: Player
   ```

4. **Link Player to Parent:**
   - Log in as organization
   - Add parent with email `bill.doss+parent@example.com`
   - Add player (without account)
   - Connect player to parent

5. **Test Parent Login:**
   - Log in with `bill.doss+parent@example.com`
   - Should see connected player's data

All emails will be delivered to `bill.doss@example.com`, but each account is separate in Supabase.
