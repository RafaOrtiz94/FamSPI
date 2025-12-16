
-- Update Attendance Schema for Location and Exceptions
-- Usage: psql -d <database> -f update_attendance_schema.sql

BEGIN;

-- 1. Add Location columns to user_attendance_records
-- We use TEXT to store "lat,lng" or JSON string, nullable to preserve backward compatibility
ALTER TABLE user_attendance_records 
ADD COLUMN IF NOT EXISTS entry_location TEXT,
ADD COLUMN IF NOT EXISTS lunch_start_location TEXT,
ADD COLUMN IF NOT EXISTS lunch_end_location TEXT,
ADD COLUMN IF NOT EXISTS exit_location TEXT;

-- 2. Create Exceptions Table (if not exists)
CREATE TABLE IF NOT EXISTS attendance_exceptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Update Exceptions Table Schema (for existing tables)
ALTER TABLE attendance_exceptions 
ADD COLUMN IF NOT EXISTS start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS start_location TEXT,
ADD COLUMN IF NOT EXISTS arrival_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS arrival_location TEXT,
ADD COLUMN IF NOT EXISTS departure_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS departure_location TEXT,
ADD COLUMN IF NOT EXISTS return_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS return_location TEXT,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE';

-- Index for reporting
CREATE INDEX IF NOT EXISTS idx_attendance_exceptions_user_date ON attendance_exceptions(user_id, date);

COMMIT;
