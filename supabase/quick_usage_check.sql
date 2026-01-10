-- ============================================
-- QUICK USAGE CHECK
-- Fast overview of key metrics
-- ============================================

-- Database Size
SELECT 
  pg_size_pretty(pg_database_size(current_database())) as database_size;

-- Data Counts
SELECT 
  (SELECT COUNT(*) FROM icepulse_profiles) as profiles,
  (SELECT COUNT(*) FROM icepulse_organizations) as organizations,
  (SELECT COUNT(*) FROM icepulse_teams) as teams,
  (SELECT COUNT(*) FROM icepulse_games) as games,
  (SELECT COUNT(*) FROM icepulse_video_recordings) as video_recordings,
  (SELECT COUNT(*) FROM icepulse_streams WHERE is_active = true) as active_streams,
  (SELECT COUNT(*) FROM icepulse_stream_chunks) as stream_chunks;

-- Largest Tables
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size('public.' || tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'icepulse_%'
ORDER BY pg_total_relation_size('public.' || tablename) DESC
LIMIT 5;
