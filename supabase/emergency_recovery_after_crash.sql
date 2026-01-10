-- Emergency Recovery Script - Run this after Supabase crashes
-- This will:
-- 1. Kill any stuck queries
-- 2. Add performance indexes
-- 3. Check for locks

-- ============================================
-- STEP 1: Kill stuck queries (if any)
-- ============================================

-- Find and kill any queries that have been running for more than 30 seconds
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT pid, query, now() - query_start as duration
    FROM pg_stat_activity
    WHERE state = 'active'
    AND now() - query_start > interval '30 seconds'
    AND pid != pg_backend_pid()
    AND query NOT LIKE '%pg_stat_activity%'
  LOOP
    RAISE NOTICE 'Killing stuck query: PID %, Duration: %, Query: %', r.pid, r.duration, left(r.query, 100);
    PERFORM pg_terminate_backend(r.pid);
  END LOOP;
END $$;

-- ============================================
-- STEP 2: Add performance indexes for RLS policies
-- ============================================

-- Streams table indexes
CREATE INDEX IF NOT EXISTS idx_streams_created_by ON icepulse_streams(created_by);
CREATE INDEX IF NOT EXISTS idx_streams_game_created ON icepulse_streams(game_id, created_by);
CREATE INDEX IF NOT EXISTS idx_streams_game_active ON icepulse_streams(game_id, is_active);

-- Stream chunks table indexes
CREATE INDEX IF NOT EXISTS idx_stream_chunks_stream_id_fast ON icepulse_stream_chunks(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_chunks_stream_index ON icepulse_stream_chunks(stream_id, chunk_index);

-- Video recordings table indexes (critical for RLS policy performance)
CREATE INDEX IF NOT EXISTS idx_video_recordings_user_id ON icepulse_video_recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_video_recordings_game_user ON icepulse_video_recordings(game_id, user_id);
CREATE INDEX IF NOT EXISTS idx_video_recordings_game_status ON icepulse_video_recordings(game_id, upload_status);
CREATE INDEX IF NOT EXISTS idx_video_recordings_game_status_timestamp ON icepulse_video_recordings(game_id, upload_status, recording_start_timestamp);

-- Games table indexes (for RLS policy checks)
CREATE INDEX IF NOT EXISTS idx_games_team_id ON icepulse_games(team_id);
CREATE INDEX IF NOT EXISTS idx_games_organization_id ON icepulse_games(organization_id);

-- Player assignments indexes (for parent/player RLS checks)
CREATE INDEX IF NOT EXISTS idx_player_assignments_team_player ON icepulse_player_assignments(team_id, player_id);
CREATE INDEX IF NOT EXISTS idx_player_assignments_player_team ON icepulse_player_assignments(player_id, team_id);

-- Parent connections indexes (critical for parent RLS policies)
CREATE INDEX IF NOT EXISTS idx_parent_connections_parent_player ON icepulse_parent_player_connections(parent_id, player_id);
CREATE INDEX IF NOT EXISTS idx_parent_connections_player_parent ON icepulse_parent_player_connections(player_id, parent_id);

-- Player assignments indexes for season lookups (critical for parent season access)
CREATE INDEX IF NOT EXISTS idx_player_assignments_season_team ON icepulse_player_assignments(season_id, team_id);
CREATE INDEX IF NOT EXISTS idx_player_assignments_season_player ON icepulse_player_assignments(season_id, player_id);

-- Players table indexes
CREATE INDEX IF NOT EXISTS idx_players_profile_id ON icepulse_players(profile_id);
CREATE INDEX IF NOT EXISTS idx_players_individual_user_id ON icepulse_players(individual_user_id);

-- Parents table indexes
CREATE INDEX IF NOT EXISTS idx_parents_profile_id ON icepulse_parents(profile_id);

-- ============================================
-- STEP 3: Analyze tables to update query planner statistics
-- ============================================

ANALYZE icepulse_streams;
ANALYZE icepulse_stream_chunks;
ANALYZE icepulse_video_recordings;
ANALYZE icepulse_games;
ANALYZE icepulse_player_assignments;
ANALYZE icepulse_parent_player_connections;
ANALYZE icepulse_players;
ANALYZE icepulse_parents;
ANALYZE icepulse_seasons;
ANALYZE icepulse_teams;

-- ============================================
-- STEP 4: Check for remaining locks
-- ============================================

SELECT 
  'Locks check' as status,
  COUNT(*) as active_locks
FROM pg_locks
WHERE NOT granted;

-- ============================================
-- STEP 5: Verify indexes were created
-- ============================================

SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN (
  'icepulse_streams',
  'icepulse_stream_chunks',
  'icepulse_video_recordings',
  'icepulse_games',
  'icepulse_player_assignments',
  'icepulse_parent_player_connections',
  'icepulse_players',
  'icepulse_parents'
)
ORDER BY tablename, indexname;
