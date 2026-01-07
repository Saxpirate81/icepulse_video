-- Locations Table
-- Stores unique locations/rinks that can be reused for games

-- Drop existing policies if they exist (to avoid conflicts)
-- Note: These will only work if the table exists, so they're safe to run
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'icepulse_locations') THEN
    DROP POLICY IF EXISTS "Org members can view locations" ON icepulse_locations;
    DROP POLICY IF EXISTS "Org members can manage locations" ON icepulse_locations;
  END IF;
END $$;

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS icepulse_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES icepulse_organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES icepulse_profiles(id) ON DELETE SET NULL
);

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'icepulse_locations_organization_id_name_key'
  ) THEN
    ALTER TABLE icepulse_locations 
    ADD CONSTRAINT icepulse_locations_organization_id_name_key 
    UNIQUE(organization_id, name);
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_icepulse_locations_organization ON icepulse_locations(organization_id);
CREATE INDEX IF NOT EXISTS idx_icepulse_locations_name ON icepulse_locations(name);

-- Enable RLS
ALTER TABLE icepulse_locations ENABLE ROW LEVEL SECURITY;

-- Organization owners and coaches can view locations in their organization
CREATE POLICY "Org members can view locations"
  ON icepulse_locations FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT c.organization_id FROM icepulse_coaches c
      WHERE c.profile_id = auth.uid()
    )
  );

-- Organization owners and coaches can manage locations in their organization
CREATE POLICY "Org members can manage locations"
  ON icepulse_locations FOR ALL
  USING (
    organization_id IN (
      SELECT id FROM icepulse_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT c.organization_id FROM icepulse_coaches c
      WHERE c.profile_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_icepulse_locations_updated_at
  BEFORE UPDATE ON icepulse_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
