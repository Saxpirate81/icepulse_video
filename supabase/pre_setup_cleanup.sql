-- ============================================
-- PRE-SETUP CLEANUP
-- Run this FIRST before running complete_setup_all_tables.sql
-- This will check for and kill any stuck queries/locks
-- ============================================

-- Step 1: Check for blocking queries
SELECT 
  pid,
  usename,
  application_name,
  client_addr,
  state,
  query_start,
  state_change,
  wait_event_type,
  wait_event,
  query
FROM pg_stat_activity
WHERE state != 'idle'
  AND pid != pg_backend_pid()
ORDER BY query_start;

-- Step 2: Kill any long-running queries (over 5 minutes)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state != 'idle'
  AND pid != pg_backend_pid()
  AND query_start < NOW() - INTERVAL '5 minutes'
  AND query NOT LIKE '%pg_stat_activity%';

-- Step 3: Check for locks
SELECT 
  l.locktype,
  l.database,
  l.relation::regclass,
  l.page,
  l.tuple,
  l.virtualxid,
  l.transactionid,
  l.classid,
  l.objid,
  l.objsubid,
  l.virtualtransaction,
  l.pid,
  l.mode,
  l.granted,
  a.usename,
  a.query,
  a.query_start,
  age(now(), a.query_start) AS "age"
FROM pg_locks l
LEFT JOIN pg_stat_activity a ON l.pid = a.pid
WHERE l.pid != pg_backend_pid()
ORDER BY a.query_start;

-- Step 4: Kill any blocking locks (be careful with this!)
-- Only run if you see blocking locks above
-- SELECT pg_terminate_backend(pid)
-- FROM pg_locks
-- WHERE NOT granted
--   AND pid != pg_backend_pid();

-- Step 5: Check table sizes (to see if there's excessive data)
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'icepulse_%'
ORDER BY size_bytes DESC;

-- Step 6: Check connection count
SELECT 
  count(*) as total_connections,
  count(*) FILTER (WHERE state = 'active') as active_connections,
  count(*) FILTER (WHERE state = 'idle') as idle_connections,
  count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
FROM pg_stat_activity
WHERE datname = current_database();

-- Step 7: Reset any stuck transactions (if needed)
-- Only run if you see "idle in transaction" connections above
-- SELECT pg_terminate_backend(pid)
-- FROM pg_stat_activity
-- WHERE state = 'idle in transaction'
--   AND pid != pg_backend_pid()
--   AND state_change < NOW() - INTERVAL '10 minutes';
