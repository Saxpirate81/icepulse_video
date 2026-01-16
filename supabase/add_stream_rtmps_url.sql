-- Add RTMPS URL support for Mux live streams
-- This keeps the existing stream schema intact while adding the RTMPS ingest URL.

ALTER TABLE icepulse_streams
ADD COLUMN IF NOT EXISTS rtmps_url TEXT;

-- Optional: index if you plan to query by rtmps_url (not required)
-- CREATE INDEX IF NOT EXISTS idx_streams_rtmps_url ON icepulse_streams(rtmps_url);
