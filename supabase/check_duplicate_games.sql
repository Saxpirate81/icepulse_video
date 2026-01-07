-- Check for duplicate games
-- Run this to see if there are duplicates

-- 1. View all games with their details
SELECT 
  id,
  opponent,
  game_date,
  game_time,
  team_id,
  season_id,
  notes,
  created_at
FROM icepulse_games
ORDER BY created_at DESC
LIMIT 50;

-- 2. Find potential duplicates (same opponent, date, time, team)
SELECT 
  opponent,
  game_date,
  game_time,
  team_id,
  COUNT(*) as count
FROM icepulse_games
GROUP BY opponent, game_date, game_time, team_id
HAVING COUNT(*) > 1;

-- 3. To delete duplicates (keeping the oldest one), uncomment and run:
-- DELETE FROM icepulse_games a
-- USING icepulse_games b
-- WHERE a.id > b.id
--   AND a.opponent = b.opponent
--   AND a.game_date = b.game_date
--   AND COALESCE(a.game_time, '') = COALESCE(b.game_time, '')
--   AND a.team_id = b.team_id;

-- 4. To see video recordings and their associated games:
SELECT 
  vr.id as recording_id,
  vr.video_url,
  vr.upload_status,
  vr.created_at as recording_created,
  g.opponent,
  g.game_date,
  g.game_time
FROM icepulse_video_recordings vr
JOIN icepulse_games g ON g.id = vr.game_id
ORDER BY vr.created_at DESC
LIMIT 20;
