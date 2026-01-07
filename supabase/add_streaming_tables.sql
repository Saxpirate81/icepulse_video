-- Streaming tables for live video streaming functionality

-- Stream metadata table
CREATE TABLE IF NOT EXISTS icepulse_streams (
  id TEXT PRIMARY KEY,
  game_id UUID REFERENCES icepulse_games(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stream chunks table (for buffered streaming)
CREATE TABLE IF NOT EXISTS icepulse_stream_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id TEXT REFERENCES icepulse_streams(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  video_url TEXT NOT NULL,
  duration_seconds INTEGER,
  file_size_bytes BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_streams_game_id ON icepulse_streams(game_id);
CREATE INDEX IF NOT EXISTS idx_streams_is_active ON icepulse_streams(is_active);
CREATE INDEX IF NOT EXISTS idx_stream_chunks_stream_id ON icepulse_stream_chunks(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_chunks_chunk_index ON icepulse_stream_chunks(stream_id, chunk_index);

-- RLS Policies for streams (public read, authenticated write)
ALTER TABLE icepulse_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE icepulse_stream_chunks ENABLE ROW LEVEL SECURITY;

-- Anyone can view active streams (for public viewing)
CREATE POLICY "Anyone can view active streams"
  ON icepulse_streams FOR SELECT
  USING (is_active = true);

-- Anyone can view stream chunks for active streams
CREATE POLICY "Anyone can view stream chunks"
  ON icepulse_stream_chunks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM icepulse_streams
      WHERE icepulse_streams.id = icepulse_stream_chunks.stream_id
      AND icepulse_streams.is_active = true
    )
  );

-- Authenticated users can create streams
CREATE POLICY "Authenticated users can create streams"
  ON icepulse_streams FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Stream creators can update their streams
CREATE POLICY "Stream creators can update streams"
  ON icepulse_streams FOR UPDATE
  USING (created_by = auth.uid());

-- Authenticated users can insert chunks for streams they created
CREATE POLICY "Users can insert chunks for their streams"
  ON icepulse_stream_chunks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM icepulse_streams
      WHERE icepulse_streams.id = icepulse_stream_chunks.stream_id
      AND icepulse_streams.created_by = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_stream_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
CREATE TRIGGER update_streams_updated_at
  BEFORE UPDATE ON icepulse_streams
  FOR EACH ROW
  EXECUTE FUNCTION update_stream_updated_at();
