ALTER TABLE trainings
  ADD COLUMN IF NOT EXISTS manual_signed_drive_id text,
  ADD COLUMN IF NOT EXISTS manual_signed_drive_url text,
  ADD COLUMN IF NOT EXISTS manual_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS manual_signed_by_user_id integer REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS absent_manual_signed_drive_id text,
  ADD COLUMN IF NOT EXISTS absent_manual_signed_drive_url text,
  ADD COLUMN IF NOT EXISTS absent_manual_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS absent_manual_signed_by_user_id integer REFERENCES users(id);
