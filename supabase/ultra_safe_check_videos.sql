-- ULTRA SAFE Diagnostic Queries - Won't timeout
-- Run these ONE AT A TIME, not all at once

-- 1. First, just count videos for the game (very fast)
SELECT COUNT(*) as total_videos
FROM icepulse_video_recordings
WHERE game_id = 'ff9f85d2-7aa7-4e9d-9c85-7fc188835e40';

-- 2. Count by status (also fast)
SELECT 
  upload_status,
  COUNT(*) as count
FROM icepulse_video_recordings
WHERE game_id = 'ff9f85d2-7aa7-4e9d-9c85-7fc188835e40'
GROUP BY upload_status;

-- 3. Check if ANY videos exist at all (fastest possible)
SELECT EXISTS(
  SELECT 1 
  FROM icepulse_video_recordings 
  WHERE game_id = 'ff9f85d2-7aa7-4e9d-9c85-7fc188835e40'
  LIMIT 1
) as videos_exist;

-- 4. Get just IDs and status (limited, very fast)
SELECT id, upload_status, created_at
FROM icepulse_video_recordings
WHERE game_id = 'ff9f85d2-7aa7-4e9d-9c85-7fc188835e40'
ORDER BY created_at DESC
LIMIT 10;

-- 5. Check total videos in entire table (to see if table is huge)
SELECT COUNT(*) as total_videos_in_table
FROM icepulse_video_recordings;
