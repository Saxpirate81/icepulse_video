-- Row Level Security (RLS) Policies
-- This file contains all RLS policies for data access control

-- Enable RLS on all tables
ALTER TABLE icepulse_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE icepulse_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE icepulse_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE icepulse_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE icepulse_coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE icepulse_coach_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE icepulse_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE icepulse_player_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE icepulse_jersey_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE icepulse_parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE icepulse_parent_player_connections ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES POLICIES
-- ============================================

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON icepulse_profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON icepulse_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Organization/Coach roles can view profiles in their organization
CREATE POLICY "Organization/Coach can view profiles in their org"
  ON icepulse_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM icepulse_organizations o
      WHERE o.owner_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM icepulse_coaches c
        JOIN icepulse_organizations org ON c.organization_id = org.id
        WHERE c.profile_id = auth.uid() AND org.id = o.id
      )
    )
  );

-- ============================================
-- ORGANIZATIONS POLICIES
-- ============================================

-- Organization owners can view their organization
CREATE POLICY "Owners can view own organization"
  ON icepulse_organizations FOR SELECT
  USING (owner_id = auth.uid());

-- Organization owners can update their organization
CREATE POLICY "Owners can update own organization"
  ON icepulse_organizations FOR UPDATE
  USING (owner_id = auth.uid());

-- Organization owners can insert their organization
CREATE POLICY "Owners can insert own organization"
  ON icepulse_organizations FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- Coaches can view organization they're assigned to
CREATE POLICY "Coaches can view assigned organization"
  ON icepulse_organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM icepulse_coaches c
      WHERE c.profile_id = auth.uid() AND c.organization_id = icepulse_organizations.id
    )
  );

-- ============================================
-- TEAMS POLICIES
-- ============================================

-- Organization owners/coaches can manage teams in their organization
CREATE POLICY "Org members can view teams"
  ON icepulse_teams FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT c.organization_id FROM icepulse_coaches c
      WHERE c.profile_id = auth.uid()
    )
    OR individual_user_id = auth.uid()
  );

CREATE POLICY "Org members can manage teams"
  ON icepulse_teams FOR ALL
  USING (
    organization_id IN (
      SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT c.organization_id FROM icepulse_coaches c
      WHERE c.profile_id = auth.uid()
    )
    OR individual_user_id = auth.uid()
  );

-- ============================================
-- SEASONS POLICIES
-- ============================================

-- Organization owners/coaches can manage seasons in their organization
CREATE POLICY "Org members can view seasons"
  ON icepulse_seasons FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT c.organization_id FROM icepulse_coaches c
      WHERE c.profile_id = auth.uid()
    )
    OR individual_user_id = auth.uid()
  );

CREATE POLICY "Org members can manage seasons"
  ON icepulse_seasons FOR ALL
  USING (
    organization_id IN (
      SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT c.organization_id FROM icepulse_coaches c
      WHERE c.profile_id = auth.uid()
    )
    OR individual_user_id = auth.uid()
  );

-- ============================================
-- COACHES POLICIES
-- ============================================

-- Organization owners/coaches can view coaches in their organization
CREATE POLICY "Org members can view coaches"
  ON icepulse_coaches FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT c.organization_id FROM icepulse_coaches c
      WHERE c.profile_id = auth.uid()
    )
    OR individual_user_id = auth.uid()
    OR profile_id = auth.uid()
  );

CREATE POLICY "Org members can manage coaches"
  ON icepulse_coaches FOR ALL
  USING (
    organization_id IN (
      SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT c.organization_id FROM icepulse_coaches c
      WHERE c.profile_id = auth.uid()
    )
    OR individual_user_id = auth.uid()
  );

-- ============================================
-- COACH ASSIGNMENTS POLICIES
-- ============================================

CREATE POLICY "Org members can view coach assignments"
  ON icepulse_coach_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM icepulse_coaches c
      WHERE c.id = icepulse_coach_assignments.coach_id
      AND (
        c.organization_id IN (
          SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
          UNION
          SELECT c2.organization_id FROM icepulse_coaches c2
          WHERE c2.profile_id = auth.uid()
        )
        OR c.individual_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Org members can manage coach assignments"
  ON icepulse_coach_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM icepulse_coaches c
      WHERE c.id = icepulse_coach_assignments.coach_id
      AND (
        c.organization_id IN (
          SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
          UNION
          SELECT c2.organization_id FROM icepulse_coaches c2
          WHERE c2.profile_id = auth.uid()
        )
        OR c.individual_user_id = auth.uid()
      )
    )
  );

-- ============================================
-- PLAYERS POLICIES
-- ============================================

-- Organization owners/coaches can view players in their organization
CREATE POLICY "Org members can view players"
  ON icepulse_players FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT c.organization_id FROM icepulse_coaches c
      WHERE c.profile_id = auth.uid()
    )
    OR individual_user_id = auth.uid()
    OR profile_id = auth.uid()
  );

-- Parents can view their connected players
CREATE POLICY "Parents can view connected players"
  ON icepulse_players FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM icepulse_parent_player_connections ppc
      JOIN icepulse_parents p ON ppc.parent_id = p.id
      WHERE ppc.player_id = icepulse_players.id
      AND p.profile_id = auth.uid()
    )
  );

CREATE POLICY "Org members can manage players"
  ON icepulse_players FOR ALL
  USING (
    organization_id IN (
      SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT c.organization_id FROM icepulse_coaches c
      WHERE c.profile_id = auth.uid()
    )
    OR individual_user_id = auth.uid()
  );

-- ============================================
-- PLAYER ASSIGNMENTS POLICIES
-- ============================================

CREATE POLICY "Org members can view player assignments"
  ON icepulse_player_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM icepulse_players p
      WHERE p.id = icepulse_player_assignments.player_id
      AND (
        p.organization_id IN (
          SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
          UNION
          SELECT c.organization_id FROM icepulse_coaches c
          WHERE c.profile_id = auth.uid()
        )
        OR p.individual_user_id = auth.uid()
        OR p.profile_id = auth.uid()
      )
    )
  );

-- Parents can view their child's assignments
CREATE POLICY "Parents can view child assignments"
  ON icepulse_player_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM icepulse_parent_player_connections ppc
      JOIN icepulse_parents par ON ppc.parent_id = par.id
      WHERE ppc.player_id = icepulse_player_assignments.player_id
      AND par.profile_id = auth.uid()
    )
  );

CREATE POLICY "Org members can manage player assignments"
  ON icepulse_player_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM icepulse_players p
      WHERE p.id = icepulse_player_assignments.player_id
      AND (
        p.organization_id IN (
          SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
          UNION
          SELECT c.organization_id FROM icepulse_coaches c
          WHERE c.profile_id = auth.uid()
        )
        OR p.individual_user_id = auth.uid()
      )
    )
  );

-- ============================================
-- JERSEY HISTORY POLICIES
-- ============================================

CREATE POLICY "Org members can view jersey history"
  ON icepulse_jersey_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM icepulse_player_assignments pa
      JOIN icepulse_players p ON pa.player_id = p.id
      WHERE pa.id = icepulse_jersey_history.player_assignment_id
      AND (
        p.organization_id IN (
          SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
          UNION
          SELECT c.organization_id FROM icepulse_coaches c
          WHERE c.profile_id = auth.uid()
        )
        OR p.individual_user_id = auth.uid()
        OR p.profile_id = auth.uid()
      )
    )
  );

-- ============================================
-- PARENTS POLICIES
-- ============================================

CREATE POLICY "Org members can view parents"
  ON icepulse_parents FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT c.organization_id FROM icepulse_coaches c
      WHERE c.profile_id = auth.uid()
    )
    OR profile_id = auth.uid()
  );

CREATE POLICY "Org members can manage parents"
  ON icepulse_parents FOR ALL
  USING (
    organization_id IN (
      SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT c.organization_id FROM icepulse_coaches c
      WHERE c.profile_id = auth.uid()
    )
  );

-- ============================================
-- PARENT-PLAYER CONNECTIONS POLICIES
-- ============================================

CREATE POLICY "Org members can view parent-player connections"
  ON icepulse_parent_player_connections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM icepulse_parents p
      WHERE p.id = icepulse_parent_player_connections.parent_id
      AND (
        p.organization_id IN (
          SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
          UNION
          SELECT c.organization_id FROM icepulse_coaches c
          WHERE c.profile_id = auth.uid()
        )
      )
    )
    OR EXISTS (
      SELECT 1 FROM icepulse_parents p
      WHERE p.id = icepulse_parent_player_connections.parent_id
      AND p.profile_id = auth.uid()
    )
  );

CREATE POLICY "Org members can manage parent-player connections"
  ON icepulse_parent_player_connections FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM icepulse_parents p
      WHERE p.id = icepulse_parent_player_connections.parent_id
      AND (
        p.organization_id IN (
          SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
          UNION
          SELECT c.organization_id FROM icepulse_coaches c
          WHERE c.profile_id = auth.uid()
        )
      )
    )
  );
