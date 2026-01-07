-- Minimal Fix: Check what exists first, then create only what's needed
-- This should not timeout

-- First, check if tables already exist
SELECT 
  'Existing Tables' as status,
  table_name,
  'EXISTS' as state
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name IN ('icepulse_locations', 'icepulse_games');

-- Only create locations table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'icepulse_locations'
  ) THEN
    CREATE TABLE icepulse_locations (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id UUID NOT NULL,
      name TEXT NOT NULL,
      city TEXT,
      state TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      created_by UUID
    );
    RAISE NOTICE 'Created icepulse_locations table';
  ELSE
    RAISE NOTICE 'icepulse_locations table already exists';
  END IF;
END $$;

-- Only create games table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'icepulse_games'
  ) THEN
    CREATE TABLE icepulse_games (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id UUID NOT NULL,
      team_id UUID NOT NULL,
      season_id UUID NOT NULL,
      game_date DATE NOT NULL,
      game_time TIME,
      opponent TEXT NOT NULL,
      location TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      created_by UUID
    );
    RAISE NOTICE 'Created icepulse_games table';
  ELSE
    RAISE NOTICE 'icepulse_games table already exists';
  END IF;
END $$;

-- Verify tables were created
SELECT 
  'Final Status' as status,
  table_name
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name IN ('icepulse_locations', 'icepulse_games')
ORDER BY table_name;
