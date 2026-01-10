-- Check if videos exist for ANY game
-- This will help determine if videos were ever recorded

-- 1. Total videos across all games
SELECT COUNT(*) as total_videos_in_database FROM icepulse_video_recordings;

-- 2. Videos by game (top 10 games with most videos)
SELECT 
  g.id as game_id,
  g.opponent,
  g.game_date,
  COUNT(vr.id) as video_count,
  COUNT(CASE WHEN vr.upload_status = 'completed' THEN 1 END) as completed_count
FROM icepulse_games g
LEFT JOIN icepulse_video_recordings vr ON vr.game_id = g.id
GROUP BY g.id, g.opponent, g.game_date
ORDER BY video_count DESC, g.game_date DESC
LIMIT 10;

-- 3. Check if ANY videos exist at all (regardless of game)
SELECT 
  id,
  game_id,
  upload_status,
  recording_type,
  created_at
FROM icepulse_video_recordings
ORDER BY created_at DESC
LIMIT 5;

-- 4. Check recent video recordings (last 24 hours)
SELECT 
  id,
  game_id,
  upload_status,
  recording_type,
  description,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at))/3600 as hours_ago
FROM icepulse_video_recordings
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
