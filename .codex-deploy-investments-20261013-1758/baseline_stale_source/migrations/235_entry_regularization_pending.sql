-- Migration 235: Add entry_pending_regularization flag to attendance records
-- Used when a collaborator could not mark entry before 09:20 cutoff
-- and submits a regularization request to Talento Humano.

ALTER TABLE user_attendance_records
  ADD COLUMN IF NOT EXISTS entry_pending_regularization BOOLEAN NOT NULL DEFAULT FALSE;
