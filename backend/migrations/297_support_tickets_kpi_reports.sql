-- Migration: 297_support_tickets_kpi_reports.sql
-- Description: KPI builder configurable (jefe_ti) + soporte de reportes mensuales
--              para el modulo de tickets de soporte TI (support-tickets).
-- Date: 2026-09-18

CREATE TABLE IF NOT EXISTS support_ticket_kpi_definitions (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  metric_type VARCHAR(40) NOT NULL CHECK (metric_type IN (
    'ticket_count',
    'sla_response_compliance_pct',
    'sla_resolution_compliance_pct',
    'avg_response_minutes',
    'avg_cycle_minutes',
    'avg_delivery_minutes',
    'csat_avg'
  )),
  -- Claves whitelisteadas en supportTicketsKpi.service.js: status, ticket_type,
  -- priority, impact, urgency, category, assigned_ti_user_id. Nunca SQL libre.
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  period_type VARCHAR(20) NOT NULL DEFAULT 'current_month'
    CHECK (period_type IN ('current_month', 'last_7_days', 'last_30_days', 'last_n_months', 'all_time')),
  period_months SMALLINT CHECK (period_months IS NULL OR period_months BETWEEN 1 AND 24),
  goal_value NUMERIC(12,2),
  goal_direction VARCHAR(3) CHECK (goal_direction IS NULL OR goal_direction IN ('gte', 'lte')),
  display_order INTEGER NOT NULL DEFAULT 0,
  show_in_workspace BOOLEAN NOT NULL DEFAULT TRUE,
  show_in_reports BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT support_ticket_kpi_period_months_required
    CHECK (period_type <> 'last_n_months' OR period_months IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_st_kpi_defs_active_order
  ON support_ticket_kpi_definitions(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_st_kpi_defs_workspace
  ON support_ticket_kpi_definitions(show_in_workspace) WHERE is_active = TRUE;

COMMENT ON TABLE support_ticket_kpi_definitions IS
  'KPIs configurables por jefe_ti sobre support_tickets. metric_type y filters son un catalogo cerrado, nunca SQL/formulas libres (ver supportTicketsKpi.service.js).';
COMMENT ON COLUMN support_ticket_kpi_definitions.filters IS
  'JSONB con claves whitelisteadas: status[], ticket_type[], priority[], impact[], urgency[], category[], assigned_ti_user_id[]. Validado en app, no en DB.';

-- Auditoria ligera de generacion/descarga de reportes mensuales (no almacena
-- el archivo -- se genera on-demand; esto es solo trazabilidad de quien y cuando).
CREATE TABLE IF NOT EXISTS support_ticket_report_exports (
  id BIGSERIAL PRIMARY KEY,
  report_year SMALLINT NOT NULL,
  report_month SMALLINT NOT NULL CHECK (report_month BETWEEN 1 AND 12),
  format VARCHAR(10) NOT NULL CHECK (format IN ('pdf', 'xlsx')),
  requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_st_report_exports_period
  ON support_ticket_report_exports(report_year, report_month);

COMMENT ON TABLE support_ticket_report_exports IS
  'Auditoria de exportaciones de reporte mensual TI. El archivo se genera on-demand y no se persiste aqui.';
