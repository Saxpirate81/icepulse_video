-- Fix Index Suggestions from Supabase Linter
-- This script addresses:
-- 1. Unindexed foreign keys (add indexes for better join performance)
-- 2. Unused indexes (conservative approach - only drop from legacy/unused tables)

-- ============================================
-- ADD INDEXES FOR UNINDEXED FOREIGN KEYS
-- ============================================
-- Foreign keys should have indexes for optimal join and lookup performance

-- icepulse_games.created_by (if this column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'icepulse_games' 
    AND column_name = 'created_by'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_icepulse_games_created_by 
    ON icepulse_games(created_by);
  END IF;
END $$;

-- icepulse_locations.created_by (if this column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'icepulse_locations' 
    AND column_name = 'created_by'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_icepulse_locations_created_by 
    ON icepulse_locations(created_by);
  END IF;
END $$;

-- Legacy tables (if they exist) - add indexes for foreign keys
-- game_events table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'game_events') THEN
    -- Check and add indexes for foreign keys
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'game_events' 
      AND column_name = 'scorer_id'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_game_events_scorer_id ON game_events(scorer_id);
    END IF;
    
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'game_events' 
      AND column_name = 'first_assist_id'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_game_events_first_assist_id ON game_events(first_assist_id);
    END IF;
    
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'game_events' 
      AND column_name = 'second_assist_id'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_game_events_second_assist_id ON game_events(second_assist_id);
    END IF;
    
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'game_events' 
      AND column_name = 'player_id'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_game_events_player_id ON game_events(player_id);
    END IF;
  END IF;
END $$;

-- parent_events table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'parent_events') THEN
    CREATE INDEX IF NOT EXISTS idx_parent_events_user_id ON parent_events(user_id);
    CREATE INDEX IF NOT EXISTS idx_parent_events_game_id ON parent_events(game_id);
    CREATE INDEX IF NOT EXISTS idx_parent_events_player_id ON parent_events(player_id);
  END IF;
END $$;

-- parent_games table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'parent_games') THEN
    CREATE INDEX IF NOT EXISTS idx_parent_games_user_id ON parent_games(user_id);
  END IF;
END $$;

-- parent_players table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'parent_players') THEN
    CREATE INDEX IF NOT EXISTS idx_parent_players_user_id ON parent_players(user_id);
    CREATE INDEX IF NOT EXISTS idx_parent_players_game_id ON parent_players(game_id);
  END IF;
END $$;

-- parent_recordings table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'parent_recordings') THEN
    CREATE INDEX IF NOT EXISTS idx_parent_recordings_user_id ON parent_recordings(user_id);
    CREATE INDEX IF NOT EXISTS idx_parent_recordings_game_id ON parent_recordings(game_id);
  END IF;
END $$;

-- user_player_associations table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_player_associations') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'user_player_associations' 
      AND column_name = 'roster_membership_id'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_user_player_associations_roster_membership_id 
      ON user_player_associations(roster_membership_id);
    END IF;
  END IF;
END $$;

-- ============================================
-- REMOVE UNUSED INDEXES (CONSERVATIVE APPROACH)
-- ============================================
-- Only remove indexes from legacy tables that are confirmed unused
-- Keep indexes on active icepulse_* tables as they may be needed for:
-- - RLS policy performance
-- - Future query optimization
-- - Foreign key constraint checks

-- Legacy tables - safe to remove unused indexes
DO $$
BEGIN
  -- seasons table (legacy)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'seasons') THEN
    DROP INDEX IF EXISTS idx_seasons_organization;
  END IF;
  
  -- teams table (legacy)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'teams') THEN
    DROP INDEX IF EXISTS idx_teams_organization;
  END IF;
  
  -- games table (legacy)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'games') THEN
    DROP INDEX IF EXISTS idx_games_team;
    DROP INDEX IF EXISTS idx_games_season;
  END IF;
  
  -- persons table (legacy)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'persons') THEN
    DROP INDEX IF EXISTS idx_persons_organization;
  END IF;
  
  -- roster_memberships table (legacy)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'roster_memberships') THEN
    DROP INDEX IF EXISTS idx_roster_memberships_person;
    DROP INDEX IF EXISTS idx_roster_memberships_team;
    DROP INDEX IF EXISTS idx_roster_memberships_season;
  END IF;
  
  -- users table (legacy)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    DROP INDEX IF EXISTS idx_users_organization;
    DROP INDEX IF EXISTS idx_users_auth_user;
  END IF;
  
  -- game_events table (legacy)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'game_events') THEN
    DROP INDEX IF EXISTS idx_game_events_game;
  END IF;
END $$;

-- ============================================
-- NOTE ON UNUSED INDEXES ON ACTIVE TABLES
-- ============================================
-- The following indexes on icepulse_* tables are marked as "unused" but we're keeping them because:
-- 1. They may be needed for RLS policy performance (even if not used in queries yet)
-- 2. They may be needed for future query optimization
-- 3. They may be used by foreign key constraint checks
-- 4. The "unused" status may be due to limited query history
--
-- If you want to remove them later after confirming they're truly unnecessary, you can run:
-- DROP INDEX IF EXISTS <index_name>;
--
-- Examples of indexes we're keeping (but marked unused):
-- - idx_icepulse_seasons_individual
-- - idx_icepulse_coaches_organization
-- - idx_icepulse_coaches_individual
-- - idx_icepulse_coach_assignments_coach
-- - idx_icepulse_coach_assignments_team
-- - idx_icepulse_coach_assignments_season
-- - idx_icepulse_players_organization
-- - idx_icepulse_profiles_email
-- - idx_icepulse_profiles_role
-- - idx_icepulse_organizations_owner
-- - idx_icepulse_teams_individual
-- - idx_icepulse_seasons_organization
-- - idx_icepulse_player_assignments_player
-- - idx_icepulse_player_assignments_team
-- - idx_icepulse_player_assignments_season
-- - idx_icepulse_jersey_history_assignment
-- - idx_icepulse_parents_organization
-- - idx_icepulse_parent_player_connections_parent
-- - idx_icepulse_parent_player_connections_player
-- - idx_icepulse_locations_organization
-- - idx_icepulse_parents_email_lower
-- - idx_icepulse_players_email_lower
-- - idx_icepulse_games_season
-- - idx_icepulse_games_date
-- - idx_icepulse_games_team_season
-- - idx_icepulse_locations_name
-- - idx_video_recordings_game
-- - idx_video_recordings_team
-- - idx_video_recordings_season
-- - idx_video_recordings_start_timestamp
-- - idx_video_recordings_upload_status
-- - idx_streams_game_id
-- - idx_streams_is_active
-- - idx_stream_chunks_stream_id
-- - idx_stream_chunks_chunk_index
-- - idx_video_recordings_game_user
-- - idx_streams_game_active
-- - idx_games_organization_id
-- - idx_player_assignments_player_team
-- - idx_parent_connections_parent_player
-- - idx_parent_connections_player_parent
-- - idx_video_recordings_game_status_timestamp
-- - idx_video_recordings_game_status
-- - idx_games_team_id
-- - idx_teams_organization_id
-- - idx_coaches_profile_id
-- - idx_coach_assignments_team_coach
-- - idx_player_assignments_team_player
-- - idx_parents_profile_id
-- - idx_video_recordings_user_id
-- - idx_streams_created_by
-- - idx_streams_game_created
-- - idx_players_individual_user_id
-- - idx_player_assignments_season_team
-- - idx_player_assignments_season_player

-- ============================================
-- ANALYZE TABLES
-- ============================================
-- Update query planner statistics after index changes
ANALYZE icepulse_games;
ANALYZE icepulse_locations;

-- ============================================
-- AUTH DB CONNECTION STRATEGY
-- ============================================
-- This is a configuration setting that cannot be fixed via SQL.
-- To change from absolute to percentage-based connection allocation:
-- 1. Go to Supabase Dashboard > Project Settings > Database
-- 2. Find "Auth DB Connections" setting
-- 3. Change from absolute number (e.g., 10) to percentage (e.g., 20%)
-- This allows Auth to scale with your database instance size automatically.
