-- Make opponent column nullable in icepulse_games table
-- This allows practice and skills events to be created without an opponent

ALTER TABLE icepulse_games 
ALTER COLUMN opponent DROP NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN icepulse_games.opponent IS 'Opponent name (required for games, optional for practice/skills)';
