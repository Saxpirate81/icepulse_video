-- Kill Stuck Queries
-- Run this if you're getting timeouts on everything
-- This will terminate any blocking queries

-- First, see what's blocking (if we can)
SELECT 
  pid,
  usename,
  application_name,
  state,
  query_start,
  state_change,
  wait_event_type,
  wait_event,
  query
FROM pg_stat_activity
WHERE datname = current_database()
  AND state != 'idle'
  AND pid != pg_backend_pid()
ORDER BY query_start;

-- Kill all queries except this one (be careful!)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid != pg_backend_pid()
  AND state != 'idle';
