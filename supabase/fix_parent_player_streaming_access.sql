-- Fix RLS policies to allow parents/players to create streams and video recordings efficiently
-- This adds indexes to speed up existing RLS policy checks and prevent database timeouts

-- ============================================
-- PERFORMANCE OPTIMIZATIONS (INDEXES)
-- ============================================

-- Add indexes for fast RLS policy checks during INSERT/UPDATE operations
-- These indexes will speed up the existing policies that check:
-- - Stream creation (created_by check)
-- - Stream chunk insertion (stream_id lookup + created_by check)
-- - Video recording insertion (user_id check)

CREATE INDEX IF NOT EXISTS idx_streams_created_by ON icepulse_streams(created_by);
CREATE INDEX IF NOT EXISTS idx_streams_game_created ON icepulse_streams(game_id, created_by);
CREATE INDEX IF NOT EXISTS idx_stream_chunks_stream_id_fast ON icepulse_stream_chunks(stream_id);
CREATE INDEX IF NOT EXISTS idx_video_recordings_user_id ON icepulse_video_recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_video_recordings_game_user ON icepulse_video_recordings(game_id, user_id);

-- ============================================
-- EXISTING POLICIES (should work, but need indexes)
-- ============================================

-- Stream INSERT: "Authenticated users can create streams"
-- Policy: WITH CHECK (auth.role() = 'authenticated')
-- Status: Should work for parents/players (any authenticated user can create)

-- Stream chunk INSERT: "Users can insert chunks for their streams"
-- Policy: WITH CHECK (EXISTS (SELECT 1 FROM icepulse_streams WHERE id = stream_id AND created_by = auth.uid()))
-- Status: Should work, but needs index on streams(created_by) for fast lookup
-- Index created above: idx_streams_created_by

-- Video recording INSERT: "Users can create their own video recordings"
-- Policy: WITH CHECK (auth.uid() = user_id)
-- Status: Should work for parents/players, but needs index on user_id for fast check
-- Index created above: idx_video_recordings_user_id

-- ============================================
-- NOTES
-- ============================================

-- The existing policies should work, but the database might be slow due to:
-- 1. Missing indexes on foreign keys used in RLS policies
-- 2. Complex SELECT policies being evaluated during INSERT (Supabase behavior)
-- 
-- The indexes above should significantly speed up:
-- - Stream chunk insertion (stream_id + created_by lookup)
-- - Video recording insertion (user_id check)
-- - Stream creation (created_by check)
--
-- If issues persist after adding indexes, the complex SELECT policies might need
-- to be simplified or the INSERT policies might need to be more explicit.
