-- Migration: Add overtime support to attendance system
-- Date: 2025-12-17

-- Add overtime columns to user_attendance_records table
ALTER TABLE user_attendance_records
ADD COLUMN IF NOT EXISTS is_overtime BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS overtime_hours DECIMAL(4,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS total_hours DECIMAL(4,2) DEFAULT 0.00;

-- Create attendance_overtime table for manual overtime records
CREATE TABLE IF NOT EXISTS attendance_overtime (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    hours DECIMAL(4,2) NOT NULL CHECK (hours > 0),
    reason TEXT NOT NULL,
    location TEXT,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Prevent duplicate overtime records for same user/date
    UNIQUE(user_id, date)
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_attendance_overtime_user_date ON attendance_overtime(user_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_overtime_date ON attendance_overtime(date);

-- Add comments
COMMENT ON COLUMN user_attendance_records.is_overtime IS 'Indicates if the user worked overtime on this day';
COMMENT ON COLUMN user_attendance_records.overtime_hours IS 'Number of overtime hours worked (automatically calculated)';
COMMENT ON COLUMN user_attendance_records.total_hours IS 'Total hours worked including overtime';
COMMENT ON TABLE attendance_overtime IS 'Manual overtime records registered by users';

-- Update existing records to calculate total_hours where missing
UPDATE user_attendance_records
SET total_hours = EXTRACT(EPOCH FROM (exit_time - entry_time -
    CASE WHEN lunch_end_time IS NOT NULL AND lunch_start_time IS NOT NULL
         THEN (lunch_end_time - lunch_start_time)
         ELSE INTERVAL '0 seconds' END)) / 3600
WHERE exit_time IS NOT NULL AND total_hours = 0;
