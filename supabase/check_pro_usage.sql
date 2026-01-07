-- ============================================
-- CHECK PRO ACCOUNT RESOURCE USAGE
-- Run this to see what's actually consuming resources
-- ============================================

-- 1. Check current connection count (Pro limit is 200)
SELECT 
  count(*) as total_connections,
  count(*) FILTER (WHERE state = 'active') as active_connections,
  count(*) FILTER (WHERE state = 'idle') as idle_connections,
  count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
  count(*) FILTER (WHERE state = 'idle in transaction (aborted)') as idle_aborted,
  'Pro Plan Limit: 200' as connection_limit
FROM pg_stat_activity
WHERE datname = current_database();

-- 2. Check database size (Pro includes 8 GB, can scale)
SELECT 
  pg_size_pretty(pg_database_size(current_database())) as database_size,
  pg_database_size(current_database()) as size_bytes,
  pg_database_size(current_database()) / 1024 / 1024 / 1024 as size_gb,
  'Pro Plan: 8 GB included' as plan_info;

-- 3. Check table sizes breakdown
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
ORDER BY size_bytes DESC
LIMIT 20;

-- 4. Check for stuck/idle in transaction connections (these waste resources)
SELECT 
  count(*) as stuck_connections,
  'These hold locks and waste resources' as note
FROM pg_stat_activity
WHERE datname = current_database()
  AND state = 'idle in transaction'
  AND pid != pg_backend_pid()
  AND state_change < NOW() - INTERVAL '5 minutes';

-- 5. List all connections by application (see what's creating them)
SELECT 
  application_name,
  count(*) as connection_count,
  count(*) FILTER (WHERE state = 'active') as active,
  count(*) FILTER (WHERE state = 'idle') as idle,
  count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
  max(query_start) as last_query
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid != pg_backend_pid()
GROUP BY application_name
ORDER BY connection_count DESC;

-- 6. Check for long-running queries
SELECT 
  count(*) as long_running_queries,
  'Queries running > 30 seconds' as note
FROM pg_stat_activity
WHERE datname = current_database()
  AND state != 'idle'
  AND pid != pg_backend_pid()
  AND query_start < NOW() - INTERVAL '30 seconds';

-- 7. Check current disk provisioned size
SELECT 
  setting as current_disk_size_gb,
  'Check if this matches your usage' as note
FROM pg_settings
WHERE name = 'max_wal_size';
