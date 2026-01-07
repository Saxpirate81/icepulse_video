# Multiple Organizations Support

## Overview

Users can be part of multiple organizations simultaneously. When a user signs up with an email that matches records in multiple organizations, they are automatically linked to all of them.

## How It Works

### 1. User Added to Multiple Organizations

**Scenario:**
- Organization A adds "John Doe" as a player (email: `john@example.com`)
- Organization B adds "John Doe" as a coach (email: `john@example.com`)
- Organization C adds "John Doe" as a parent (email: `john@example.com`)

### 2. User Signs Up

When John signs up with `john@example.com`:
- Profile is created in `icepulse_profiles`
- **Automatic linking trigger** finds all matching records:
  - Links to Organization A (as player)
  - Links to Organization B (as coach)
  - Links to Organization C (as parent)
- All three organizations are now accessible to John

### 3. User Logs In

When John logs in:
- System finds all organizations where John is a member:
  - Organizations he **owns** (created)
  - Organizations where he's a **player**
  - Organizations where he's a **coach**
  - Organizations where he's a **parent**

### 4. Organization Switcher

If John is part of **2 or more organizations**:
- **Organization dropdown** appears in the top right of the dashboard
- Shows all organizations with role indicator:
  - "Hockey Club A (Owner)" - if he owns it
  - "Hockey Club B (coach)" - if he's a coach
  - "Hockey Club C (parent)" - if he's a parent
- John can switch between organizations to view different data

### 5. Viewing Data

When John selects an organization:
- Sees only that organization's data:
  - Teams, seasons, players, coaches, parents
  - Team assignments for that specific organization
  - Stats and records for that organization
- Cannot see data from other organizations (unless he switches)

## Access Levels

### Organization Owner
- **Full access** to all features
- Can edit organization name
- Can manage all teams, seasons, players, coaches, parents
- Can delete the organization

### Organization Member (Player/Coach/Parent)
- **Limited access** based on role
- Can view their own data (assignments, stats)
- Cannot edit organization settings
- Cannot manage other members (unless they have coach permissions)

## Database Structure

### How Organizations Are Found

The system searches for organizations in this order:

1. **Owned Organizations:**
   ```sql
   SELECT * FROM icepulse_organizations 
   WHERE owner_id = user_id
   ```

2. **Player Organizations:**
   ```sql
   SELECT DISTINCT organization_id 
   FROM icepulse_players 
   WHERE profile_id = user_id
   ```

3. **Coach Organizations:**
   ```sql
   SELECT DISTINCT organization_id 
   FROM icepulse_coaches 
   WHERE profile_id = user_id
   ```

4. **Parent Organizations:**
   ```sql
   SELECT DISTINCT organization_id 
   FROM icepulse_parents 
   WHERE profile_id = user_id
   ```

### Data Isolation

Each organization's data is isolated:
- Teams belong to one organization (`organization_id`)
- Players belong to one organization (`organization_id`)
- Coaches belong to one organization (`organization_id`)
- Parents belong to one organization (`organization_id`)

When switching organizations, only data for that `organization_id` is loaded.

## UI Features

### Organization Switcher
- **Location**: Top right of Organizational Dashboard
- **Visibility**: Only shown if user is part of 2+ organizations
- **Format**: Dropdown with organization name and role
- **Behavior**: Clicking switches to that organization and reloads all data

### Role Indicator
- Shows user's role in the current organization
- Example: "You are viewing Hockey Club A as a coach"
- Helps users understand their access level

## Example Scenarios

### Scenario 1: Multi-Team Player
- Player is on Team A (Organization 1) and Team B (Organization 2)
- When they log in, they see both organizations
- Can switch to see Team A's schedule, then switch to see Team B's schedule

### Scenario 2: Coach + Parent
- User is a coach for Organization 1
- User is also a parent in Organization 2 (their child plays there)
- Can switch between organizations to:
  - Manage their team (as coach)
  - View their child's stats (as parent)

### Scenario 3: Organization Owner + Member
- User owns Organization A
- User is also a player in Organization B
- Can switch between:
  - Organization A: Full management access
  - Organization B: Player view only

## Technical Details

### Context Updates
- `OrgContext` now tracks:
  - `organizations`: Array of all orgs user is part of
  - `selectedOrgId`: Currently selected organization
  - `switchOrganization()`: Function to switch orgs

### Data Loading
- When organization is switched, `loadOrganization(orgId)` is called
- All data (teams, seasons, players, etc.) is reloaded for that org
- Previous organization's data is cleared

### Performance
- Organizations list is cached after first load
- Only the selected organization's data is loaded
- Switching is fast (just a database query for that org's data)

## Limitations

1. **No Cross-Organization Views:**
   - Cannot see data from multiple orgs at once
   - Must switch between orgs to view different data

2. **Role-Based Access:**
   - Access level is per-organization
   - Being an owner in Org A doesn't give you access to Org B

3. **Data Isolation:**
   - Teams, players, etc. belong to one organization
   - Cannot share data between organizations (by design)

## Future Enhancements

Potential improvements:
- Aggregate view showing data from all organizations
- Cross-organization player/coach search
- Organization comparison views
- Bulk operations across organizations
