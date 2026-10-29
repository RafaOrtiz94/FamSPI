-- Migration: Add origin department fields to requests table
-- Purpose: Track which department created the request for proper Drive folder organization
-- Date: 2026-01-08

-- Add origin department fields to requests table
ALTER TABLE requests
ADD COLUMN IF NOT EXISTS origin_department_id INTEGER REFERENCES departments(id),
ADD COLUMN IF NOT EXISTS origin_department_name TEXT;

-- Add comments
COMMENT ON COLUMN requests.origin_department_id IS 'ID of the department that created this request (from users.department_id)';
COMMENT ON COLUMN requests.origin_department_name IS 'Name of the department that created this request (cached for performance)';

-- Create index for department queries
CREATE INDEX IF NOT EXISTS idx_requests_origin_department ON requests(origin_department_id) WHERE origin_department_id IS NOT NULL;

-- Add drive folder columns for general use (if not exist)
ALTER TABLE requests
ADD COLUMN IF NOT EXISTS drive_department_folder_id TEXT,
ADD COLUMN IF NOT EXISTS drive_user_folder_id TEXT,
ADD COLUMN IF NOT EXISTS drive_type_folder_id TEXT,
ADD COLUMN IF NOT EXISTS drive_request_folder_id TEXT;

-- Add comments for drive folder columns
COMMENT ON COLUMN requests.drive_department_folder_id IS 'Google Drive folder ID for the department root folder';
COMMENT ON COLUMN requests.drive_user_folder_id IS 'Google Drive folder ID for the user-specific folder within department';
COMMENT ON COLUMN requests.drive_type_folder_id IS 'Google Drive folder ID for the request type folder within user folder';
COMMENT ON COLUMN requests.drive_request_folder_id IS 'Google Drive folder ID for the specific request folder (REQ-xxxx)';

-- Create indexes for drive folder performance
CREATE INDEX IF NOT EXISTS idx_requests_drive_department_folder ON requests(drive_department_folder_id) WHERE drive_department_folder_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_requests_drive_user_folder ON requests(drive_user_folder_id) WHERE drive_user_folder_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_requests_drive_type_folder ON requests(drive_type_folder_id) WHERE drive_type_folder_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_requests_drive_request_folder ON requests(drive_request_folder_id) WHERE drive_request_folder_id IS NOT NULL;