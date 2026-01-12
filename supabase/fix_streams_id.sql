-- Fix icepulse_streams id column to auto-generate UUIDs
ALTER TABLE icepulse_streams ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Allow lookup by cloudflare_live_input_id for easier URL sharing
CREATE INDEX IF NOT EXISTS idx_icepulse_streams_cf_input_id ON icepulse_streams(cloudflare_live_input_id);
