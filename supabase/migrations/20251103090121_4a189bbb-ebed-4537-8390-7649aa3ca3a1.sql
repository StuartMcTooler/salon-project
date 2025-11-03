-- 1. Create business_type enum
CREATE TYPE business_type AS ENUM ('multi_staff_salon', 'solo_professional');

-- 2. Create business_accounts table
CREATE TABLE business_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  business_type business_type NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(owner_user_id)
);

ALTER TABLE business_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own business"
  ON business_accounts FOR SELECT
  USING (owner_user_id = auth.uid());

CREATE POLICY "Users can create their own business"
  ON business_accounts FOR INSERT
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Users can update their own business"
  ON business_accounts FOR UPDATE
  USING (owner_user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_business_accounts_updated_at
  BEFORE UPDATE ON business_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 3. Add business_id to staff_members
ALTER TABLE staff_members 
  ADD COLUMN business_id UUID REFERENCES business_accounts(id) ON DELETE CASCADE;

-- 4. Create walk_in_settings table
CREATE TABLE walk_in_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
  allow_walk_ins BOOLEAN DEFAULT false,
  walk_in_buffer_minutes INTEGER DEFAULT 15,
  walk_in_notice_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(business_id)
);

ALTER TABLE walk_in_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can manage walk-in settings"
  ON walk_in_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM business_accounts 
      WHERE business_accounts.id = walk_in_settings.business_id 
      AND business_accounts.owner_user_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_walk_in_settings_updated_at
  BEFORE UPDATE ON walk_in_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. Create indexes for performance
CREATE INDEX idx_staff_members_business_id ON staff_members(business_id);
CREATE INDEX idx_business_accounts_owner ON business_accounts(owner_user_id);