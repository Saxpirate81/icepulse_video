-- KILL STUCK QUERIES ON VIDEO_RECORDINGS TABLE
-- WARNING: Only run this if you have stuck queries blocking the table
-- Run check_database_locks.sql first to see what's stuck

-- 1. See what queries are running (check first!)
SELECT 
  pid,
  usename,
  application_name,
  state,
  wait_event_type,
  wait_event,
  NOW() - query_start as duration,
  LEFT(query, 200) as query_preview
FROM pg_stat_activity
WHERE datname = current_database()
  AND (
    query LIKE '%icepulse_video_recordings%'
    OR query LIKE '%video_recordings%'
  )
  AND state != 'idle'
  AND pid != pg_backend_pid()  -- Don't kill our own query
ORDER BY query_start;

-- 2. Kill queries that have been running for more than 30 seconds
-- UNCOMMENT AND MODIFY THE PID IF YOU NEED TO KILL A SPECIFIC QUERY:
/*
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database()
  AND (
    query LIKE '%icepulse_video_recordings%'
    OR query LIKE '%video_recordings%'
  )
  AND state != 'idle'
  AND pid != pg_backend_pid()
  AND NOW() - query_start > INTERVAL '30 seconds';
*/

-- 3. Cancel queries (softer than terminate - tries to cancel gracefully)
-- UNCOMMENT IF NEEDED:
/*
SELECT pg_cancel_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database()
  AND (
    query LIKE '%icepulse_video_recordings%'
    OR query LIKE '%video_recordings%'
  )
  AND state != 'idle'
  AND pid != pg_backend_pid()
  AND NOW() - query_start > INTERVAL '30 seconds';
*/
