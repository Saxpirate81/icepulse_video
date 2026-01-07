-- ============================================
-- DIAGNOSE RESOURCE USAGE
-- Run these queries to identify what's consuming resources
-- ============================================

-- 1. Check total connection count
SELECT 
  count(*) as total_connections,
  count(*) FILTER (WHERE state = 'active') as active_connections,
  count(*) FILTER (WHERE state = 'idle') as idle_connections,
  count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
  count(*) FILTER (WHERE state = 'idle in transaction (aborted)') as idle_aborted
FROM pg_stat_activity
WHERE datname = current_database();

-- 2. List all connections with details
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
  LEFT(query, 100) as query_preview
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid != pg_backend_pid()
ORDER BY query_start;

-- 3. Find long-running queries (potential resource hogs)
SELECT 
  pid,
  usename,
  application_name,
  state,
  query_start,
  NOW() - query_start as duration,
  wait_event_type,
  wait_event,
  LEFT(query, 200) as query_preview
FROM pg_stat_activity
WHERE datname = current_database()
  AND state != 'idle'
  AND pid != pg_backend_pid()
  AND query_start < NOW() - INTERVAL '30 seconds'
ORDER BY query_start;

-- 4. Check for idle in transaction connections (these hold locks)
SELECT 
  pid,
  usename,
  application_name,
  state,
  state_change,
  NOW() - state_change as idle_duration,
  LEFT(query, 200) as query_preview
FROM pg_stat_activity
WHERE datname = current_database()
  AND state = 'idle in transaction'
  AND pid != pg_backend_pid()
ORDER BY state_change;

-- 5. Check table sizes (large tables consume resources)
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size,
  pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'icepulse_%'
ORDER BY size_bytes DESC;

-- 6. Check for locks (locks can cause resource contention)
SELECT 
  l.locktype,
  l.relation::regclass as table_name,
  l.mode,
  l.granted,
  a.pid,
  a.usename,
  a.state,
  a.query_start,
  LEFT(a.query, 100) as query_preview
FROM pg_locks l
LEFT JOIN pg_stat_activity a ON l.pid = a.pid
WHERE l.pid != pg_backend_pid()
  AND l.relation IS NOT NULL
ORDER BY a.query_start;

-- 7. Count connections by application (identify source)
SELECT 
  application_name,
  count(*) as connection_count,
  count(*) FILTER (WHERE state = 'active') as active,
  count(*) FILTER (WHERE state = 'idle') as idle,
  count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid != pg_backend_pid()
GROUP BY application_name
ORDER BY connection_count DESC;

-- 8. Check database size
SELECT 
  pg_size_pretty(pg_database_size(current_database())) as database_size,
  pg_database_size(current_database()) as size_bytes;
