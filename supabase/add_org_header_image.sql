-- Add header_image_url column to icepulse_organizations table
-- This will store the URL of the image to display in the streaming overlay header

ALTER TABLE icepulse_organizations 
ADD COLUMN IF NOT EXISTS header_image_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN icepulse_organizations.header_image_url IS 'URL of the header image to display in streaming overlay';
