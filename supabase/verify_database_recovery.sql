-- Verify Database Recovery
-- Run these queries ONE AT A TIME to verify everything is working

-- 1. Quick health check - should return instantly
SELECT COUNT(*) as total_videos FROM icepulse_video_recordings;

-- 2. Check videos by status (should be fast with indexes)
SELECT 
  upload_status,
  COUNT(*) as count
FROM icepulse_video_recordings
GROUP BY upload_status
ORDER BY count DESC;

-- 3. Check videos for the specific game from your logs
-- Game ID: ff9f85d2-7aa7-4e9d-9c85-7fc188835e40
SELECT 
  COUNT(*) as total_videos_for_game,
  COUNT(CASE WHEN upload_status = 'completed' THEN 1 END) as completed_videos
FROM icepulse_video_recordings
WHERE game_id = 'ff9f85d2-7aa7-4e9d-9c85-7fc188835e40';

-- 4. Get a few video IDs for that game (limited to prevent issues)
SELECT 
  id,
  upload_status,
  recording_type,
  description,
  created_at
FROM icepulse_video_recordings
WHERE game_id = 'ff9f85d2-7aa7-4e9d-9c85-7fc188835e40'
ORDER BY created_at DESC
LIMIT 5;

-- 5. Verify indexes exist (critical for performance)
SELECT 
  indexname,
  CASE 
    WHEN indexname = 'idx_video_recordings_game_status_timestamp' THEN '✅ CRITICAL INDEX'
    ELSE 'Index'
  END as importance
FROM pg_indexes
WHERE tablename = 'icepulse_video_recordings'
  AND (indexname LIKE '%game%' OR indexname LIKE '%status%' OR indexname LIKE '%timestamp%')
ORDER BY importance DESC, indexname;
