-- Check videos for a specific game
-- Replace 'YOUR_GAME_ID' with the actual game_id from the logs
-- From your logs, the game_id is: ff9f85d2-7aa7-4e9d-9c85-7fc188835e40
-- 
-- WARNING: If this times out, use ultra_safe_check_videos.sql instead
-- Run queries ONE AT A TIME, not all at once

-- 1. Check ALL videos for this game (regardless of status) - LIMITED to prevent timeout
SELECT 
  id,
  game_id,
  user_id,
  upload_status,
  recording_type,
  description,
  created_at
FROM icepulse_video_recordings
WHERE game_id = 'ff9f85d2-7aa7-4e9d-9c85-7fc188835e40'  -- Replace with your game_id
ORDER BY created_at DESC
LIMIT 20;  -- Limited to prevent timeout

-- 2. Count videos by status for this game
SELECT 
  upload_status,
  COUNT(*) as count
FROM icepulse_video_recordings
WHERE game_id = 'ff9f85d2-7aa7-4e9d-9c85-7fc188835e40'  -- Replace with your game_id
GROUP BY upload_status
ORDER BY count DESC;

-- 3. If videos exist but are stuck in 'uploading' or 'processing', you can update them to 'completed'
-- UNCOMMENT AND RUN THIS ONLY IF YOU WANT TO MARK STUCK VIDEOS AS COMPLETED:
/*
UPDATE icepulse_video_recordings
SET upload_status = 'completed',
    updated_at = NOW()
WHERE game_id = 'ff9f85d2-7aa7-4e9d-9c85-7fc188835e40'  -- Replace with your game_id
  AND upload_status IN ('uploading', 'processing')
  AND created_at < NOW() - INTERVAL '1 hour';  -- Only update videos older than 1 hour
*/

-- 4. Check all games and their video counts
SELECT 
  g.id as game_id,
  g.opponent,
  g.game_date,
  COUNT(vr.id) as total_videos,
  COUNT(CASE WHEN vr.upload_status = 'completed' THEN 1 END) as completed_videos,
  COUNT(CASE WHEN vr.upload_status = 'uploading' THEN 1 END) as uploading_videos,
  COUNT(CASE WHEN vr.upload_status = 'processing' THEN 1 END) as processing_videos,
  COUNT(CASE WHEN vr.upload_status = 'failed' THEN 1 END) as failed_videos
FROM icepulse_games g
LEFT JOIN icepulse_video_recordings vr ON vr.game_id = g.id
GROUP BY g.id, g.opponent, g.game_date
ORDER BY g.game_date DESC, g.opponent
LIMIT 20;
