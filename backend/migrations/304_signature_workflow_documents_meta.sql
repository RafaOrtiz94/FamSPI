-- Migration 304: meta en signature_workflow_documents
-- Necesario para la correccion de ubicacion de firma (Fase 2 del plan de
-- mejoras): antes de resellar un PDF final ya generado, se guarda ahi un
-- snapshot del final anterior (sha256/drive ids) como respaldo de auditoria,
-- sin perder el historial aunque se sobrescriban las columnas final_*.
ALTER TABLE public.signature_workflow_documents
  ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.signature_workflow_documents.meta
  IS 'JSON libre: guarda p.ej. corrections[] con snapshots del final_pdf anterior cuando se resella tras una correccion de ubicacion de firma';
