-- Check if videos exist for a specific game
-- Replace 'YOUR_GAME_ID_HERE' with the actual game_id you're testing

-- 1. List all games with video counts
SELECT 
  g.id as game_id,
  g.opponent,
  g.game_date,
  g.game_time,
  COUNT(vr.id) as total_videos,
  COUNT(CASE WHEN vr.upload_status = 'completed' THEN 1 END) as completed_videos,
  COUNT(CASE WHEN vr.upload_status = 'uploading' THEN 1 END) as uploading_videos,
  COUNT(CASE WHEN vr.upload_status = 'processing' THEN 1 END) as processing_videos,
  COUNT(CASE WHEN vr.upload_status = 'failed' THEN 1 END) as failed_videos
FROM icepulse_games g
LEFT JOIN icepulse_video_recordings vr ON vr.game_id = g.id
GROUP BY g.id, g.opponent, g.game_date, g.game_time
ORDER BY g.game_date DESC, g.game_time DESC;

-- 2. Check videos for a specific game (replace with your game_id)
-- First, get a game_id from the list above, then run:
/*
SELECT 
  vr.id,
  vr.game_id,
  vr.user_id,
  vr.video_url,
  vr.thumbnail_url,
  vr.upload_status,
  vr.recording_type,
  vr.description,
  vr.recording_start_timestamp,
  p.name as user_name,
  p.email as user_email
FROM icepulse_video_recordings vr
LEFT JOIN icepulse_profiles p ON vr.user_id = p.id
WHERE vr.game_id = 'YOUR_GAME_ID_HERE'  -- Replace with actual game_id
ORDER BY vr.recording_start_timestamp ASC;
*/

-- 3. Check all videos regardless of status
SELECT 
  upload_status,
  COUNT(*) as count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM icepulse_video_recordings
GROUP BY upload_status
ORDER BY count DESC;

-- 4. Check if RLS is blocking access
-- This will show what the current user can see
SELECT 
  COUNT(*) as visible_videos,
  COUNT(CASE WHEN upload_status = 'completed' THEN 1 END) as visible_completed
FROM icepulse_video_recordings;

-- 5. Check videos that are NOT completed (might be stuck in uploading/processing)
SELECT 
  id,
  game_id,
  upload_status,
  created_at,
  updated_at,
  EXTRACT(EPOCH FROM (NOW() - created_at))/3600 as hours_old
FROM icepulse_video_recordings
WHERE upload_status != 'completed'
ORDER BY created_at DESC
LIMIT 20;
