-- 149_attendance_reporting_indexes.sql
-- Performance indexes for attendance reports and field visit joins.

CREATE INDEX IF NOT EXISTS idx_uar_user_date_report
  ON user_attendance_records (user_id, date);

CREATE INDEX IF NOT EXISTS idx_attendance_exceptions_user_date_report
  ON attendance_exceptions (user_id, date);

CREATE INDEX IF NOT EXISTS idx_client_visit_logs_user_date_report
  ON client_visit_logs (user_email, visit_date);

CREATE INDEX IF NOT EXISTS idx_client_visit_logs_user_lower_date_report
  ON client_visit_logs ((LOWER(COALESCE(user_email, ''))), visit_date);

CREATE INDEX IF NOT EXISTS idx_prospect_visits_user_date_report
  ON prospect_visits (user_email, visit_date);

CREATE INDEX IF NOT EXISTS idx_prospect_visits_user_lower_date_report
  ON prospect_visits ((LOWER(COALESCE(user_email, ''))), visit_date);
