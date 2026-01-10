-- Create a function to efficiently create streams for players/parents
-- This function bypasses complex RLS checks by using SECURITY DEFINER
-- and performs optimized queries internally

CREATE OR REPLACE FUNCTION create_stream_for_player_parent(
  p_user_id UUID,
  p_game_id UUID
)
RETURNS TABLE (
  id TEXT,
  game_id UUID,
  created_by UUID,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stream_id TEXT;
BEGIN
  -- Generate a unique stream ID
  v_stream_id := 'stream-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 9);

  -- Create the stream and return it
  RETURN QUERY
  WITH inserted_stream AS (
    INSERT INTO icepulse_streams (
      id,
      game_id,
      created_by,
      is_active
    ) VALUES (
      v_stream_id,
      p_game_id,
      p_user_id,
      true
    )
    RETURNING *
  )
  SELECT 
    s.id,
    s.game_id,
    s.created_by,
    s.is_active,
    s.created_at,
    s.updated_at
  FROM inserted_stream s;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_stream_for_player_parent(UUID, UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION create_stream_for_player_parent IS 'Efficiently creates streams for players and parents, bypassing complex RLS checks';
