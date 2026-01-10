-- Fix Video Recordings Query Performance
-- This adds composite indexes to speed up the common query pattern
-- and optimizes the query for fetching videos by game_id
-- Optimized for Supabase Pro tier

-- 1. Add composite index for the most common query pattern:
--    Filter by game_id + upload_status, order by recording_start_timestamp
--    This index covers the WHERE and ORDER BY clauses in one index
CREATE INDEX IF NOT EXISTS idx_video_recordings_game_status_timestamp 
  ON icepulse_video_recordings(game_id, upload_status, recording_start_timestamp);

-- 2. Add composite index for game_id + upload_status (for filtering)
CREATE INDEX IF NOT EXISTS idx_video_recordings_game_status 
  ON icepulse_video_recordings(game_id, upload_status);

-- 3. Add index for user_id lookups (for the join with profiles)
-- This helps with the user:icepulse_profiles(id,name,email) join
CREATE INDEX IF NOT EXISTS idx_video_recordings_user_id 
  ON icepulse_video_recordings(user_id);

-- 3. Ensure the profiles table has an index on id (should already exist as primary key, but verify)
-- This helps with the join in the query: user:icepulse_profiles(id,name,email)
-- Note: Primary key already creates an index, but we can verify it exists

-- 4. Add index on games table for the RLS policy lookups
-- This helps the RLS policies that check game -> team -> organization
CREATE INDEX IF NOT EXISTS idx_games_team_id ON icepulse_games(team_id);
CREATE INDEX IF NOT EXISTS idx_teams_organization_id ON icepulse_teams(organization_id);

-- 5. Add indexes for coach assignments (used in RLS policies)
CREATE INDEX IF NOT EXISTS idx_coaches_profile_id ON icepulse_coaches(profile_id);
CREATE INDEX IF NOT EXISTS idx_coach_assignments_team_coach ON icepulse_coach_assignments(team_id, coach_id);

-- 6. Add indexes for player assignments (used in RLS policies)
CREATE INDEX IF NOT EXISTS idx_players_profile_id ON icepulse_players(profile_id);
CREATE INDEX IF NOT EXISTS idx_player_assignments_team_player ON icepulse_player_assignments(team_id, player_id);

-- 7. Add indexes for parent connections (used in RLS policies)
CREATE INDEX IF NOT EXISTS idx_parents_profile_id ON icepulse_parents(profile_id);
CREATE INDEX IF NOT EXISTS idx_parent_player_connections_parent_player ON icepulse_parent_player_connections(parent_id, player_id);

-- Update table statistics for query planner (Pro tier optimization)
ANALYZE icepulse_video_recordings;
ANALYZE icepulse_games;
ANALYZE icepulse_teams;
ANALYZE icepulse_organizations;
ANALYZE icepulse_profiles;

-- Verify indexes were created
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN (
  'icepulse_video_recordings',
  'icepulse_games',
  'icepulse_teams',
  'icepulse_coaches',
  'icepulse_coach_assignments',
  'icepulse_players',
  'icepulse_player_assignments',
  'icepulse_parents',
  'icepulse_parent_player_connections'
)
ORDER BY tablename, indexname;

-- Check table sizes and row counts (diagnostic)
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = schemaname AND table_name = tablename) as exists
FROM pg_tables
WHERE tablename IN (
  'icepulse_video_recordings',
  'icepulse_games',
  'icepulse_teams'
)
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check video recordings count by status
SELECT 
  upload_status,
  COUNT(*) as count,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
FROM icepulse_video_recordings
GROUP BY upload_status
ORDER BY count DESC;
