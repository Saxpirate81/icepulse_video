-- Quick check to identify what 4096 represents
-- Run each query separately to see which one returns 4096

-- Check 1: Connection count (should be < 200)
SELECT 
  'Connection Count' as metric,
  count(*) as value,
  CASE 
    WHEN count(*) > 200 THEN '⚠️ OVER LIMIT (Pro: 200)'
    WHEN count(*) > 150 THEN '⚠️ WARNING: Getting high'
    ELSE '✅ OK'
  END as status
FROM pg_stat_activity
WHERE datname = current_database();

-- Check 2: Database size in MB (should be < 8192 MB = 8 GB)
SELECT 
  'Database Size (MB)' as metric,
  pg_database_size(current_database()) / 1024 / 1024 as value_mb,
  pg_size_pretty(pg_database_size(current_database())) as value_pretty,
  CASE 
    WHEN pg_database_size(current_database()) / 1024 / 1024 / 1024 > 7.5 THEN '⚠️ WARNING: Near 8 GB limit'
    WHEN pg_database_size(current_database()) / 1024 / 1024 / 1024 > 6 THEN '⚠️ Getting high'
    ELSE '✅ OK'
  END as status;

-- Check 3: Stuck connections count
SELECT 
  'Stuck Connections' as metric,
  count(*) as value,
  CASE 
    WHEN count(*) > 10 THEN '⚠️ WARNING: Too many stuck connections'
    WHEN count(*) > 5 THEN '⚠️ Some stuck connections'
    ELSE '✅ OK'
  END as status
FROM pg_stat_activity
WHERE datname = current_database()
  AND state = 'idle in transaction'
  AND pid != pg_backend_pid()
  AND state_change < NOW() - INTERVAL '5 minutes';
