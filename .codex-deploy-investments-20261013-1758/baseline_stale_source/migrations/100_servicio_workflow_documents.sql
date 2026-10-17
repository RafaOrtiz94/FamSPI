-- 100_servicio_workflow_documents.sql
-- Trazabilidad documental ST-01-01 vinculada a flujos operativos (compras públicas/privadas)

CREATE SCHEMA IF NOT EXISTS servicio;

CREATE TABLE IF NOT EXISTS servicio.workflow_documents (
  id BIGSERIAL PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  document_code TEXT NOT NULL,
  stage_key TEXT,
  drive_file_id TEXT,
  drive_folder_id TEXT,
  request_id INTEGER,
  created_by INTEGER,
  created_by_email TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_documents_source
  ON servicio.workflow_documents (source_type, source_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_documents_document_code
  ON servicio.workflow_documents (document_code, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_workflow_documents_file
  ON servicio.workflow_documents (source_type, source_id, document_code, COALESCE(drive_file_id, ''));
