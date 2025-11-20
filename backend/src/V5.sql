-- =============================================================
-- V5.sql - Attendance Tracking System Migration
-- =============================================================
-- Description: Creates tables and indexes for employee attendance
--              tracking with digital signature integration.
-- Author: System
-- Date: 2025-11-20
-- Dependencies: V4.sql (requires lopdp_internal_signature_file_id)
-- =============================================================

-- =============================================================
-- 1. User Attendance Records Table
-- =============================================================
-- Stores daily attendance records per user with entry/exit times
-- and lunch break tracking.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.user_attendance_records (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- Time tracking fields
    entry_time TIMESTAMP WITH TIME ZONE,
    lunch_start_time TIMESTAMP WITH TIME ZONE,
    lunch_end_time TIMESTAMP WITH TIME ZONE,
    exit_time TIMESTAMP WITH TIME ZONE,
    
    -- Optional notes for special cases (late arrival, early departure, etc.)
    notes TEXT,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one record per user per day
    CONSTRAINT unique_user_date UNIQUE(user_id, date)
);

-- =============================================================
-- 2. Indexes for Performance
-- =============================================================

-- Composite index for fast user-date lookups
CREATE INDEX IF NOT EXISTS idx_attendance_user_date 
ON public.user_attendance_records(user_id, date DESC);

-- Index for date-based queries (e.g., all attendance for a specific day)
CREATE INDEX IF NOT EXISTS idx_attendance_date 
ON public.user_attendance_records(date DESC);

-- Index for finding incomplete records (missing exit time)
CREATE INDEX IF NOT EXISTS idx_attendance_incomplete 
ON public.user_attendance_records(user_id, date) 
WHERE exit_time IS NULL;

-- =============================================================
-- 3. Table Comments
-- =============================================================

COMMENT ON TABLE public.user_attendance_records IS 
'Daily attendance records per user with entry, lunch, and exit times. Integrates with user signatures from lopdp_internal_signature_file_id.';

COMMENT ON COLUMN public.user_attendance_records.user_id IS 
'Foreign key to users table';

COMMENT ON COLUMN public.user_attendance_records.date IS 
'Date of the attendance record (without time component)';

COMMENT ON COLUMN public.user_attendance_records.entry_time IS 
'Timestamp when user clocked in for the day';

COMMENT ON COLUMN public.user_attendance_records.lunch_start_time IS 
'Timestamp when user started lunch break (requires signature)';

COMMENT ON COLUMN public.user_attendance_records.lunch_end_time IS 
'Timestamp when user returned from lunch break';

COMMENT ON COLUMN public.user_attendance_records.exit_time IS 
'Timestamp when user clocked out for the day (requires signature)';

COMMENT ON COLUMN public.user_attendance_records.notes IS 
'Optional notes for special circumstances (late arrival, early departure, etc.)';

-- =============================================================
-- 4. Trigger for Updated Timestamp
-- =============================================================

CREATE OR REPLACE FUNCTION update_attendance_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_attendance_updated_at
    BEFORE UPDATE ON public.user_attendance_records
    FOR EACH ROW
    EXECUTE FUNCTION update_attendance_timestamp();

-- =============================================================
-- 5. Verification Queries
-- =============================================================
-- Run these queries after migration to verify success:
--
-- Check table exists:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' AND table_name = 'user_attendance_records';
--
-- Check indexes:
-- SELECT indexname FROM pg_indexes 
-- WHERE tablename = 'user_attendance_records';
--
-- Verify user signature fields exist (from V4.sql):
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'users' 
-- AND column_name IN ('lopdp_internal_signature_file_id', 'lopdp_internal_signed_at');
--
-- =============================================================

-- =============================================================
-- 6. Sample Data (Optional - for testing)
-- =============================================================
-- Uncomment to insert test data:
--
-- INSERT INTO public.user_attendance_records 
-- (user_id, date, entry_time, lunch_start_time, lunch_end_time, exit_time, notes)
-- VALUES 
-- (1, CURRENT_DATE, 
--  CURRENT_DATE + TIME '08:00:00', 
--  CURRENT_DATE + TIME '12:00:00',
--  CURRENT_DATE + TIME '13:00:00',
--  CURRENT_DATE + TIME '17:00:00',
--  'Test record');
--
-- =============================================================

-- Migration completed successfully
SELECT 'V5.sql migration completed successfully!' AS status;
