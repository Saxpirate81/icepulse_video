-- Check for database locks and stuck queries
-- Run this FIRST to see if something is blocking queries

-- 1. Check for active locks on the video_recordings table
SELECT 
  pid,
  usename,
  application_name,
  client_addr,
  state,
  wait_event_type,
  wait_event,
  query_start,
  state_change,
  NOW() - query_start as query_duration,
  LEFT(query, 100) as query_preview
FROM pg_stat_activity
WHERE datname = current_database()
  AND (
    query LIKE '%icepulse_video_recordings%'
    OR query LIKE '%video_recordings%'
  )
  AND state != 'idle'
ORDER BY query_start;

-- 2. Check for locks specifically
SELECT 
  l.locktype,
  l.database,
  l.relation::regclass,
  l.page,
  l.tuple,
  l.virtualxid,
  l.transactionid,
  l.mode,
  l.granted,
  a.usename,
  a.query,
  a.query_start,
  age(now(), a.query_start) AS "age",
  a.pid
FROM pg_locks l
LEFT JOIN pg_stat_activity a ON l.pid = a.pid
WHERE l.relation::regclass::text = 'icepulse_video_recordings'
ORDER BY a.query_start;

-- 3. Check table size (this should work even if queries are slow)
SELECT 
  pg_size_pretty(pg_total_relation_size('icepulse_video_recordings')) as total_size,
  pg_size_pretty(pg_relation_size('icepulse_video_recordings')) as table_size,
  pg_size_pretty(pg_total_relation_size('icepulse_video_recordings') - pg_relation_size('icepulse_video_recordings')) as indexes_size;

-- 4. Check row count estimate (very fast, uses statistics)
SELECT 
  n_live_tup as estimated_rows,
  n_dead_tup as dead_rows,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE relname = 'icepulse_video_recordings';
