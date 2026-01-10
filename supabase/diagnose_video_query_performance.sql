-- Diagnostic Query for Video Recordings Performance
-- Run this to check if indexes exist and query performance

-- 1. Check if indexes exist on video_recordings table
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'icepulse_video_recordings'
ORDER BY indexname;

-- 2. Check table statistics
SELECT 
  schemaname,
  tablename,
  n_live_tup as row_count,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE tablename = 'icepulse_video_recordings';

-- 3. Check if the composite index exists (most important)
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE tablename = 'icepulse_video_recordings' 
      AND indexname = 'idx_video_recordings_game_status_timestamp'
    ) THEN '✅ Composite index exists'
    ELSE '❌ Composite index MISSING - run fix_video_recordings_performance.sql'
  END as index_status;

-- 4. Test query performance (explain plan)
-- Replace 'YOUR_GAME_ID_HERE' with an actual game_id from your database
EXPLAIN ANALYZE
SELECT 
  vr.*,
  p.id as user_id,
  p.name as user_name,
  p.email as user_email
FROM icepulse_video_recordings vr
LEFT JOIN icepulse_profiles p ON vr.user_id = p.id
WHERE vr.game_id = (SELECT id FROM icepulse_games LIMIT 1)
  AND vr.upload_status = 'completed'
ORDER BY vr.recording_start_timestamp ASC
LIMIT 100;

-- 5. Check for slow queries or locks
SELECT 
  pid,
  now() - pg_stat_activity.query_start AS duration,
  query,
  state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 seconds'
  AND state != 'idle'
ORDER BY duration DESC;
