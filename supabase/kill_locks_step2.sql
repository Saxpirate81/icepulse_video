-- Step 2: Kill ONE lock at a time (run this after Step 1)
-- Replace '12345' with an actual PID from Step 1 results

-- First, get a PID to kill:
SELECT pid 
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid != pg_backend_pid()
  AND state != 'idle'
ORDER BY query_start
LIMIT 1;

-- Then kill it (replace PID with actual number):
-- SELECT pg_terminate_backend(12345);
