-- SAFE Diagnostic Query - Won't crash your database
-- Run this FIRST to check the state before trying to view videos

-- 1. Check if table exists and has data (very fast)
SELECT 
  COUNT(*) as total_videos,
  COUNT(CASE WHEN upload_status = 'completed' THEN 1 END) as completed_videos,
  COUNT(CASE WHEN upload_status != 'completed' THEN 1 END) as other_status_videos
FROM icepulse_video_recordings;

-- 2. Check videos per game (limited to prevent crashes)
SELECT 
  game_id,
  COUNT(*) as video_count,
  COUNT(CASE WHEN upload_status = 'completed' THEN 1 END) as completed_count
FROM icepulse_video_recordings
GROUP BY game_id
ORDER BY video_count DESC
LIMIT 10;

-- 3. Check if indexes exist (critical for performance)
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'icepulse_video_recordings'
  AND indexname LIKE '%game%' OR indexname LIKE '%status%' OR indexname LIKE '%timestamp%'
ORDER BY indexname;

-- 4. Check for the critical composite index
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE tablename = 'icepulse_video_recordings' 
      AND indexname = 'idx_video_recordings_game_status_timestamp'
    ) THEN '✅ Critical index EXISTS'
    ELSE '❌ Critical index MISSING - run fix_video_recordings_performance.sql'
  END as index_status;
