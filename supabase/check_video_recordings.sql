-- Check if any video recordings exist in the database
-- Run this to see if videos are being saved

-- 1. Count total video recordings
SELECT COUNT(*) as total_recordings FROM icepulse_video_recordings;

-- 2. List all video recordings with details
SELECT 
  id,
  game_id,
  user_id,
  video_url,
  thumbnail_url,
  duration_seconds,
  file_size_bytes,
  recording_type,
  description,
  upload_status,
  recording_start_timestamp,
  created_at
FROM icepulse_video_recordings
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check recordings by upload status
SELECT 
  upload_status,
  COUNT(*) as count
FROM icepulse_video_recordings
GROUP BY upload_status;

-- 4. Check if videos are linked to games
SELECT 
  vr.id as recording_id,
  vr.video_url,
  vr.recording_type,
  vr.description,
  vr.upload_status,
  g.opponent,
  g.game_date,
  g.game_time
FROM icepulse_video_recordings vr
LEFT JOIN icepulse_games g ON g.id = vr.game_id
ORDER BY vr.created_at DESC
LIMIT 10;
