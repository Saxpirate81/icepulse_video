-- Add event_type column to icepulse_games table
-- This allows games to be categorized as 'game', 'practice', or 'skills'

ALTER TABLE icepulse_games 
ADD COLUMN IF NOT EXISTS event_type TEXT DEFAULT 'game' CHECK (event_type IN ('game', 'practice', 'skills'));

-- Update existing games to have event_type = 'game' if NULL
UPDATE icepulse_games 
SET event_type = 'game' 
WHERE event_type IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN icepulse_games.event_type IS 'Type of event: game, practice, or skills';
