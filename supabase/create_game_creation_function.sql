-- Create a function to efficiently create games for players/parents
-- This function bypasses complex RLS checks by using SECURITY DEFINER
-- and performs optimized queries internally

CREATE OR REPLACE FUNCTION create_game_for_player_parent(
  p_user_id UUID,
  p_user_role TEXT,
  p_team_id UUID,
  p_season_id UUID,
  p_opponent TEXT,
  p_game_date DATE,
  p_game_time TIME DEFAULT NULL,
  p_location TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  team_id UUID,
  season_id UUID,
  organization_id UUID,
  opponent TEXT,
  game_date DATE,
  game_time TIME,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organization_id UUID;
  v_player_ids UUID[];
  v_has_access BOOLEAN := FALSE;
BEGIN
  -- Get organization_id from team
  SELECT icepulse_teams.organization_id INTO v_organization_id
  FROM icepulse_teams
  WHERE icepulse_teams.id = p_team_id
  LIMIT 1;

  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'Team not found or no organization associated';
  END IF;

  -- Verify access based on user role
  IF p_user_role = 'player' THEN
    -- Get player IDs for this user
    SELECT ARRAY_AGG(icepulse_players.id) INTO v_player_ids
    FROM icepulse_players
    WHERE icepulse_players.profile_id = p_user_id OR icepulse_players.individual_user_id = p_user_id
    LIMIT 10;

    IF v_player_ids IS NULL OR array_length(v_player_ids, 1) = 0 THEN
      RAISE EXCEPTION 'Player record not found';
    END IF;

    -- Check if player has assignment for this team and season
    SELECT EXISTS (
      SELECT 1 FROM icepulse_player_assignments pa
      WHERE pa.player_id = ANY(v_player_ids)
      AND pa.team_id = p_team_id
      AND pa.season_id = p_season_id
    ) INTO v_has_access;

  ELSIF p_user_role = 'parent' THEN
    -- Get parent's connected player IDs
    SELECT ARRAY_AGG(p.id) INTO v_player_ids
    FROM icepulse_parents par
    JOIN icepulse_parent_player_connections ppc ON par.id = ppc.parent_id
    JOIN icepulse_players p ON ppc.player_id = p.id
    WHERE par.profile_id = p_user_id
    LIMIT 10;

    IF v_player_ids IS NULL OR array_length(v_player_ids, 1) = 0 THEN
      RAISE EXCEPTION 'No connected players found for parent';
    END IF;

    -- Check if any connected player has assignment for this team and season
    SELECT EXISTS (
      SELECT 1 FROM icepulse_player_assignments pa
      WHERE pa.player_id = ANY(v_player_ids)
      AND pa.team_id = p_team_id
      AND pa.season_id = p_season_id
    ) INTO v_has_access;

  ELSIF p_user_role = 'organization' OR p_user_role = 'coach' THEN
    -- For organization/coach users: verify they own the organization associated with this team
    SELECT EXISTS (
      SELECT 1 FROM icepulse_organizations o
      WHERE o.id = v_organization_id
      AND o.owner_id = p_user_id
    ) INTO v_has_access;

    -- If user is a coach, also check if they're assigned to this organization
    IF NOT v_has_access AND p_user_role = 'coach' THEN
      SELECT EXISTS (
        SELECT 1 FROM icepulse_coaches c
        WHERE c.organization_id = v_organization_id
        AND c.profile_id = p_user_id
      ) INTO v_has_access;
    END IF;

    IF NOT v_has_access THEN
      RAISE EXCEPTION 'User does not have permission to create games for this organization';
    END IF;

  ELSE
    RAISE EXCEPTION 'Invalid user role for game creation';
  END IF;

  -- For players/parents, check access to team/season
  IF (p_user_role = 'player' OR p_user_role = 'parent') AND NOT v_has_access THEN
    RAISE EXCEPTION 'User does not have access to create games for this team and season';
  END IF;

  -- Create the game and return it
  RETURN QUERY
  WITH inserted_game AS (
    INSERT INTO icepulse_games (
      team_id,
      season_id,
      organization_id,
      opponent,
      game_date,
      game_time,
      location,
      notes
    ) VALUES (
      p_team_id,
      p_season_id,
      v_organization_id,
      p_opponent,
      p_game_date,
      p_game_time,
      p_location,
      p_notes
    )
    RETURNING *
  )
  SELECT 
    g.id,
    g.team_id,
    g.season_id,
    g.organization_id,
    g.opponent,
    g.game_date,
    g.game_time,
    g.location,
    g.notes,
    g.created_at,
    g.updated_at
  FROM inserted_game g;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_game_for_player_parent(UUID, TEXT, UUID, UUID, TEXT, DATE, TIME, TEXT, TEXT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION create_game_for_player_parent IS 'Efficiently creates games for players and parents, bypassing complex RLS checks';
