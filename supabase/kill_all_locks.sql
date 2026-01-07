-- Kill All Locks
-- This will terminate all blocking queries and transactions
-- Run this in Supabase SQL Editor to unlock your database

-- First, see what's locked
SELECT 
  'Current Locks' as status,
  pid,
  usename,
  application_name,
  state,
  wait_event_type,
  wait_event,
  query_start,
  state_change,
  LEFT(query, 100) as query_preview
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid != pg_backend_pid()
  AND state != 'idle'
ORDER BY query_start;

-- Kill all blocking queries (except this one)
SELECT pg_terminate_backend(pid) as killed
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid != pg_backend_pid()
  AND state != 'idle';

-- Verify locks are cleared
SELECT 
  'Remaining Locks' as status,
  COUNT(*) as active_queries
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid != pg_backend_pid()
  AND state != 'idle';
