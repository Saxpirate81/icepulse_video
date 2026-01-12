-- Add streaming permission columns to icepulse_profiles table
-- This allows organizations to control which users can stream live video

ALTER TABLE icepulse_profiles 
ADD COLUMN IF NOT EXISTS can_stream_live BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS streaming_enabled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS streaming_enabled_by UUID REFERENCES icepulse_profiles(id);

-- Set all existing users to false (no streaming by default)
UPDATE icepulse_profiles 
SET can_stream_live = false 
WHERE can_stream_live IS NULL;

-- Add index for faster permission lookups
CREATE INDEX IF NOT EXISTS idx_profiles_can_stream_live 
ON icepulse_profiles(can_stream_live) 
WHERE can_stream_live = true;

-- Add comment for documentation
COMMENT ON COLUMN icepulse_profiles.can_stream_live IS 'Whether this user has permission to stream live video. Controlled by organization admins.';
COMMENT ON COLUMN icepulse_profiles.streaming_enabled_at IS 'Timestamp when streaming permission was enabled for this user';
COMMENT ON COLUMN icepulse_profiles.streaming_enabled_by IS 'ID of the user (typically org admin) who enabled streaming for this user';
