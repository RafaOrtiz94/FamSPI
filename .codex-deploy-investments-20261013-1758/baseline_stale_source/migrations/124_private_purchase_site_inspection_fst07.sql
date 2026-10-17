-- 124_private_purchase_site_inspection_fst07.sql
-- Objetivo:
-- 1) Persistir inspección de sitio F.ST-07 en compras privadas.
-- 2) Soportar reinspecciones con historial.
-- 3) Habilitar regla de bloqueo de instalación hasta sitio conforme.

ALTER TABLE private_purchase_requests
  ADD COLUMN IF NOT EXISTS site_inspection JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS site_inspection_status TEXT,
  ADD COLUMN IF NOT EXISTS site_inspection_result TEXT,
  ADD COLUMN IF NOT EXISTS site_inspection_follow_up_date DATE,
  ADD COLUMN IF NOT EXISTS site_inspection_report_document_id TEXT,
  ADD COLUMN IF NOT EXISTS site_inspection_report_link TEXT,
  ADD COLUMN IF NOT EXISTS site_inspection_report_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS site_inspection_ready_for_installation BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS site_inspection_requires_reinspection BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS site_inspection_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS site_inspection_updated_by INTEGER,
  ADD COLUMN IF NOT EXISTS site_inspection_updated_by_email TEXT;

CREATE INDEX IF NOT EXISTS idx_private_purchase_site_inspection_status
  ON private_purchase_requests (site_inspection_status, site_inspection_ready_for_installation);

COMMENT ON COLUMN private_purchase_requests.site_inspection
  IS 'Estado estructurado de inspección/reinspección F.ST-07 (checklist, historial y trazabilidad)';
COMMENT ON COLUMN private_purchase_requests.site_inspection_status
  IS 'Estado derivado: pending | non_compliant_reinspection_pending | ready_for_installation';
COMMENT ON COLUMN private_purchase_requests.site_inspection_ready_for_installation
  IS 'True cuando el sitio está conforme y habilita instalación/entrega';
