-- ============================================
-- COMPREHENSIVE USAGE CHECK
-- Quick overview of database, storage, and app data usage
-- ============================================

-- 1. DATABASE SIZE
SELECT 
  'Database Size' as metric,
  pg_size_pretty(pg_database_size(current_database())) as value,
  pg_database_size(current_database()) as bytes,
  'Total database size including indexes' as description;

-- 2. TABLE SIZES (Top 10 largest tables)
SELECT 
  'Table Sizes' as section,
  tablename,
  pg_size_pretty(pg_total_relation_size('public.' || tablename)) AS total_size,
  pg_size_pretty(pg_relation_size('public.' || tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size('public.' || tablename) - pg_relation_size('public.' || tablename)) AS indexes_size,
  pg_total_relation_size('public.' || tablename) AS size_bytes
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'icepulse_%'
ORDER BY size_bytes DESC
LIMIT 10;

-- 3. APP DATA COUNTS
SELECT 
  'User Profiles' as metric,
  COUNT(*) as count
FROM icepulse_profiles
UNION ALL
SELECT 
  'Organizations',
  COUNT(*)
FROM icepulse_organizations
UNION ALL
SELECT 
  'Teams',
  COUNT(*)
FROM icepulse_teams
UNION ALL
SELECT 
  'Games/Events',
  COUNT(*)
FROM icepulse_games
UNION ALL
SELECT 
  'Video Recordings',
  COUNT(*)
FROM icepulse_video_recordings
UNION ALL
SELECT 
  'Active Streams',
  COUNT(*)
FROM icepulse_streams
WHERE is_active = true
UNION ALL
SELECT 
  'Total Streams',
  COUNT(*)
FROM icepulse_streams
UNION ALL
SELECT 
  'Stream Chunks',
  COUNT(*)
FROM icepulse_stream_chunks
ORDER BY metric;

-- 4. VIDEO RECORDINGS BREAKDOWN
SELECT 
  'Video Recordings by Status' as section,
  CASE 
    WHEN video_url IS NOT NULL THEN 'Has Video URL'
    ELSE 'Missing Video URL'
  END as status,
  COUNT(*) as count,
  pg_size_pretty(SUM(COALESCE(file_size_bytes, 0))) as estimated_total_size
FROM icepulse_video_recordings
GROUP BY status;

-- 5. STORAGE BUCKET USAGE (if you have access to storage.objects)
-- Note: This requires appropriate permissions
SELECT 
  'Storage Objects' as metric,
  COUNT(*) as file_count,
  pg_size_pretty(SUM((metadata->>'size')::bigint)) as total_size,
  SUM((metadata->>'size')::bigint) as total_bytes
FROM storage.objects
WHERE bucket_id = 'videos'
  AND metadata->>'size' IS NOT NULL
UNION ALL
SELECT 
  'Storage by Folder',
  COUNT(*),
  pg_size_pretty(SUM((metadata->>'size')::bigint)),
  SUM((metadata->>'size')::bigint)
FROM storage.objects
WHERE bucket_id = 'videos'
  AND (storage.foldername(name))[1] = 'streams'
  AND metadata->>'size' IS NOT NULL
GROUP BY (storage.foldername(name))[1];

-- 6. CONNECTION COUNT
SELECT 
  'Database Connections' as metric,
  COUNT(*) as total_connections,
  COUNT(*) FILTER (WHERE state = 'active') as active,
  COUNT(*) FILTER (WHERE state = 'idle') as idle,
  'Current active connections' as description
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid != pg_backend_pid();

-- 7. RECENT ACTIVITY (last 24 hours)
SELECT 
  'Recent Activity (24h)' as section,
  'Games Created' as metric,
  COUNT(*) as count
FROM icepulse_games
WHERE created_at > NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 
  'Recent Activity (24h)',
  'Videos Recorded',
  COUNT(*)
FROM icepulse_video_recordings
WHERE created_at > NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 
  'Recent Activity (24h)',
  'Streams Created',
  COUNT(*)
FROM icepulse_streams
WHERE created_at > NOW() - INTERVAL '24 hours';

-- 8. LARGEST VIDEO FILES (if file_size_bytes is tracked)
SELECT 
  'Largest Video Files' as section,
  id,
  game_id,
  created_at,
  pg_size_pretty(file_size_bytes) as file_size,
  file_size_bytes,
  video_url
FROM icepulse_video_recordings
WHERE file_size_bytes IS NOT NULL
ORDER BY file_size_bytes DESC
LIMIT 10;
