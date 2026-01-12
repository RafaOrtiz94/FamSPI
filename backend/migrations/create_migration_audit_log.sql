-- Create migration audit log table for tracking all migration activities
-- This table provides full audit trail for the Business Case Wizard normalization

CREATE TABLE IF NOT EXISTS migration_audit_log (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL,
    phase VARCHAR(50) NOT NULL,
    operation VARCHAR(100) NOT NULL,
    table_name VARCHAR(100),
    field_name VARCHAR(100),
    rows_affected INTEGER DEFAULT 0,
    details TEXT,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    execution_duration_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_migration_audit_log_migration_name ON migration_audit_log(migration_name);
CREATE INDEX IF NOT EXISTS idx_migration_audit_log_phase ON migration_audit_log(phase);
CREATE INDEX IF NOT EXISTS idx_migration_audit_log_executed_at ON migration_audit_log(executed_at);
CREATE INDEX IF NOT EXISTS idx_migration_audit_log_success ON migration_audit_log(success);

-- Add comments for documentation
COMMENT ON TABLE migration_audit_log IS 'Audit log for all Business Case Wizard database migration activities';
COMMENT ON COLUMN migration_audit_log.migration_name IS 'Name of the migration script (e.g., 035_historical_backfill_option_b)';
COMMENT ON COLUMN migration_audit_log.phase IS 'Migration phase (e.g., backfill_execution, validation_checkpoint)';
COMMENT ON COLUMN migration_audit_log.operation IS 'Specific operation performed (e.g., includes_lis_backfill)';
COMMENT ON COLUMN migration_audit_log.rows_affected IS 'Number of database rows affected by the operation';
COMMENT ON COLUMN migration_audit_log.execution_duration_ms IS 'How long the operation took in milliseconds';
