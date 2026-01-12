-- Migration: Add commercial drive folder IDs to requests table
-- Purpose: Store folder hierarchy for commercial requests (Comercial > User > Type > Request)
-- Date: 2026-01-08

-- Add columns to store commercial folder hierarchy IDs
ALTER TABLE requests
ADD COLUMN IF NOT EXISTS drive_comercial_folder_id TEXT,
ADD COLUMN IF NOT EXISTS drive_user_folder_id TEXT,
ADD COLUMN IF NOT EXISTS drive_type_folder_id TEXT,
ADD COLUMN IF NOT EXISTS drive_request_folder_id TEXT;

-- Add comment explaining the purpose
COMMENT ON COLUMN requests.drive_comercial_folder_id IS 'Google Drive folder ID for the main "Comercial" folder at root level';
COMMENT ON COLUMN requests.drive_user_folder_id IS 'Google Drive folder ID for the user-specific folder within "Comercial"';
COMMENT ON COLUMN requests.drive_type_folder_id IS 'Google Drive folder ID for the request type folder (e.g., "Inspección de Ambiente")';
COMMENT ON COLUMN requests.drive_request_folder_id IS 'Google Drive folder ID for the specific request folder (REQ-xxxx)';

-- Create index for better query performance on folder operations
CREATE INDEX IF NOT EXISTS idx_requests_drive_comercial_folder ON requests(drive_comercial_folder_id) WHERE drive_comercial_folder_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_requests_drive_user_folder ON requests(drive_user_folder_id) WHERE drive_user_folder_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_requests_drive_type_folder ON requests(drive_type_folder_id) WHERE drive_type_folder_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_requests_drive_request_folder ON requests(drive_request_folder_id) WHERE drive_request_folder_id IS NOT NULL;

-- Insert migration record
INSERT INTO migrations (name, executed_at) VALUES ('045_add_commercial_drive_folder_ids', NOW());