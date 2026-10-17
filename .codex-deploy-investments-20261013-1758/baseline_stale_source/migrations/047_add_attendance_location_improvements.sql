-- Migration: Add location improvements to attendance tables
-- Date: 2026-01-08

-- Add location metadata to user_attendance_records
ALTER TABLE user_attendance_records
ADD COLUMN IF NOT EXISTS entry_location_accuracy NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS entry_location_timestamp TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS entry_location_source TEXT DEFAULT 'gps',
ADD COLUMN IF NOT EXISTS lunch_start_location_accuracy NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS lunch_start_location_timestamp TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS lunch_start_location_source TEXT DEFAULT 'gps',
ADD COLUMN IF NOT EXISTS lunch_end_location_accuracy NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS lunch_end_location_timestamp TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS lunch_end_location_source TEXT DEFAULT 'gps',
ADD COLUMN IF NOT EXISTS exit_location_accuracy NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS exit_location_timestamp TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS exit_location_source TEXT DEFAULT 'gps';

-- Add location metadata to attendance_exceptions
ALTER TABLE attendance_exceptions
ADD COLUMN IF NOT EXISTS start_location_accuracy NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS start_location_timestamp TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS start_location_source TEXT DEFAULT 'gps',
ADD COLUMN IF NOT EXISTS arrival_location_accuracy NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS arrival_location_timestamp TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS arrival_location_source TEXT DEFAULT 'gps',
ADD COLUMN IF NOT EXISTS departure_location_accuracy NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS departure_location_timestamp TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS departure_location_source TEXT DEFAULT 'gps',
ADD COLUMN IF NOT EXISTS return_location_accuracy NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS return_location_timestamp TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS return_location_source TEXT DEFAULT 'gps';

-- Add overtime automatic fields
ALTER TABLE user_attendance_records
ADD COLUMN IF NOT EXISTS auto_shift_end_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS auto_closed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS overtime_start_at TIMESTAMP WITH TIME ZONE;

-- Add comments
COMMENT ON COLUMN user_attendance_records.auto_shift_end_at IS 'Calculated timestamp when 8h shift should end (entry_time + 8 hours)';
COMMENT ON COLUMN user_attendance_records.auto_closed_at IS 'Timestamp when system automatically closed the shift';
COMMENT ON COLUMN user_attendance_records.overtime_start_at IS 'Timestamp when overtime counting started (same as auto_shift_end_at)';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_attendance_records_auto_shift_end_at ON user_attendance_records(auto_shift_end_at);
CREATE INDEX IF NOT EXISTS idx_user_attendance_records_auto_closed_at ON user_attendance_records(auto_closed_at);