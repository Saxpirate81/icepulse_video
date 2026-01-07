-- SIMPLE: Kill Locks (One Query at a Time)
-- If the full script times out, try running these ONE AT A TIME

-- Step 1: Just see what's locked (run this first)
SELECT pid, state, wait_event_type, wait_event
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid != pg_backend_pid()
  AND state != 'idle'
LIMIT 5;
