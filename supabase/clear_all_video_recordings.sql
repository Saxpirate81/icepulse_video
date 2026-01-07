-- Clear All Video Recordings
-- WARNING: This will delete ALL video recordings from the database
-- Run this to clean up test recordings

-- 1. First, list what will be deleted (for safety)
SELECT 
  COUNT(*) as total_recordings,
  COUNT(DISTINCT game_id) as unique_games,
  SUM(file_size_bytes) / 1024 / 1024 as total_size_mb
FROM icepulse_video_recordings;

-- 2. List all recordings that will be deleted
SELECT 
  id,
  game_id,
  video_url,
  recording_type,
  description,
  created_at
FROM icepulse_video_recordings
ORDER BY created_at DESC;

-- 3. Delete all video recordings from database
-- UNCOMMENT THE LINE BELOW TO ACTUALLY DELETE:
-- DELETE FROM icepulse_video_recordings;

-- 4. Optional: Delete games that were created for Skills/Practice recordings
-- (Only if you want to clean up test events too)
-- First, see which games are Skills/Practice:
-- SELECT id, opponent, notes, created_at 
-- FROM icepulse_games 
-- WHERE opponent IN ('Skills', 'Practice') OR notes LIKE '%Skills%' OR notes LIKE '%Practice%'
-- ORDER BY created_at DESC;

-- Then delete them (UNCOMMENT TO DELETE):
-- DELETE FROM icepulse_games 
-- WHERE opponent IN ('Skills', 'Practice') 
--    OR notes LIKE '%Skills recording%' 
--    OR notes LIKE '%Practice recording%';
