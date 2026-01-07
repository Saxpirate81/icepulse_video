-- ============================================
-- CLEANUP RESOURCES
-- Run these to free up resources
-- ⚠️ BE CAREFUL - These will kill connections!
-- ============================================

-- 1. Kill idle in transaction connections (older than 10 minutes)
-- These hold locks and waste resources
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database()
  AND state = 'idle in transaction'
  AND pid != pg_backend_pid()
  AND state_change < NOW() - INTERVAL '10 minutes';

-- 2. Kill long-running queries (older than 5 minutes)
-- Only kills non-system queries
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database()
  AND state != 'idle'
  AND pid != pg_backend_pid()
  AND query_start < NOW() - INTERVAL '5 minutes'
  AND query NOT LIKE '%pg_stat_activity%'
  AND query NOT LIKE '%pg_locks%';

-- 3. Kill idle connections from specific applications (if needed)
-- Uncomment and modify if you see too many connections from a specific app
-- SELECT pg_terminate_backend(pid)
-- FROM pg_stat_activity
-- WHERE datname = current_database()
--   AND state = 'idle'
--   AND pid != pg_backend_pid()
--   AND application_name = 'your-app-name-here'
--   AND state_change < NOW() - INTERVAL '30 minutes';

-- 4. Check what will be killed (run this first to see what would be affected)
-- SELECT 
--   pid,
--   usename,
--   application_name,
--   state,
--   query_start,
--   state_change,
--   LEFT(query, 100) as query_preview
-- FROM pg_stat_activity
-- WHERE datname = current_database()
--   AND (
--     (state = 'idle in transaction' AND state_change < NOW() - INTERVAL '10 minutes')
--     OR (state != 'idle' AND query_start < NOW() - INTERVAL '5 minutes' AND query NOT LIKE '%pg_stat_activity%')
--   )
--   AND pid != pg_backend_pid();
