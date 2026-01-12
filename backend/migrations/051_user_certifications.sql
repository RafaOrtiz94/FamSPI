-- Migration: 051_user_certifications.sql
-- Description: Create user_certifications table for storing user credentials/certifications
-- Date: 2026-01-09

-- Create user_certifications table
CREATE TABLE IF NOT EXISTS user_certifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  issuer VARCHAR(255),
  issue_date DATE,
  expiry_date DATE,
  credential_type VARCHAR(50) DEFAULT 'certification' CHECK (credential_type IN ('certification', 'course', 'diploma', 'title', 'other')),
  description TEXT,
  drive_file_id TEXT,
  drive_folder_id TEXT,
  file_url TEXT,
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_certifications_user_id ON user_certifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_certifications_type ON user_certifications(credential_type);
CREATE INDEX IF NOT EXISTS idx_user_certifications_active ON user_certifications(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_certifications_created_at ON user_certifications(created_at);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_user_certifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_certifications_updated_at
  BEFORE UPDATE ON user_certifications
  FOR EACH ROW
  EXECUTE FUNCTION update_user_certifications_updated_at();

-- Grant permissions (adjust based on your role system)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON user_certifications TO your_app_role;
-- GRANT USAGE ON SEQUENCE user_certifications_id_seq TO your_app_role;