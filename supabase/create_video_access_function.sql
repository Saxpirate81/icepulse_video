-- Create a function to efficiently fetch videos for players/parents
-- This function bypasses complex RLS checks by using SECURITY DEFINER
-- and performs optimized queries internally

CREATE OR REPLACE FUNCTION get_player_parent_videos(
  p_user_id UUID,
  p_user_role TEXT,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  game_id UUID,
  user_id UUID,
  video_url TEXT,
  thumbnail_url TEXT,
  duration_seconds NUMERIC,
  recording_start_timestamp TIMESTAMPTZ,
  upload_status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_ids UUID[];
  v_team_ids UUID[];
  v_game_ids UUID[];
BEGIN
  -- Get player IDs based on user role
  IF p_user_role = 'player' THEN
    SELECT ARRAY_AGG(icepulse_players.id) INTO v_player_ids
    FROM icepulse_players
    WHERE icepulse_players.profile_id = p_user_id OR icepulse_players.individual_user_id = p_user_id
    LIMIT 10;
  ELSIF p_user_role = 'parent' THEN
    -- Get parent's connected player IDs
    SELECT ARRAY_AGG(p.id) INTO v_player_ids
    FROM icepulse_parents par
    JOIN icepulse_parent_player_connections ppc ON par.id = ppc.parent_id
    JOIN icepulse_players p ON ppc.player_id = p.id
    WHERE par.profile_id = p_user_id
    LIMIT 10;
  ELSE
    -- Not a player or parent, return empty
    RETURN;
  END IF;

  -- If no players found, return empty
  IF v_player_ids IS NULL OR array_length(v_player_ids, 1) = 0 THEN
    RETURN;
  END IF;

  -- Get team IDs from player assignments
  SELECT ARRAY_AGG(DISTINCT icepulse_player_assignments.team_id) INTO v_team_ids
  FROM icepulse_player_assignments
  WHERE icepulse_player_assignments.player_id = ANY(v_player_ids)
  LIMIT 10;

  -- If no teams found, return empty
  IF v_team_ids IS NULL OR array_length(v_team_ids, 1) = 0 THEN
    RETURN;
  END IF;

  -- Get game IDs for these teams
  SELECT ARRAY_AGG(icepulse_games.id) INTO v_game_ids
  FROM icepulse_games
  WHERE icepulse_games.team_id = ANY(v_team_ids)
  LIMIT 10;

  -- If no games found, return empty
  IF v_game_ids IS NULL OR array_length(v_game_ids, 1) = 0 THEN
    RETURN;
  END IF;

  -- Return videos for these games
  RETURN QUERY
  SELECT 
    vr.id,
    vr.game_id,
    vr.user_id,
    vr.video_url,
    vr.thumbnail_url,
    vr.duration_seconds,
    vr.recording_start_timestamp,
    vr.upload_status,
    vr.created_at,
    vr.updated_at
  FROM icepulse_video_recordings vr
  WHERE vr.game_id = ANY(v_game_ids)
    AND vr.upload_status = 'completed'
  ORDER BY vr.recording_start_timestamp DESC
  LIMIT p_limit;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_player_parent_videos(UUID, TEXT, INTEGER) TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_player_parent_videos IS 'Efficiently fetches videos accessible to players and parents, bypassing complex RLS checks';
