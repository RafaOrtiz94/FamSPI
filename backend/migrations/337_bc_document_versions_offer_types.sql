-- Migration 337: bc_document_versions acepta los documentos de oferta.
-- businessCaseOffer.service.js registra 'offer_sheet' y 'offer_pdf', que el CHECK
-- de la migracion 157 rechazaba (el error quedaba oculto como warning no fatal).

ALTER TABLE bc_document_versions
  DROP CONSTRAINT IF EXISTS bc_document_versions_document_type_check;

ALTER TABLE bc_document_versions
  ADD CONSTRAINT bc_document_versions_document_type_check
  CHECK (document_type IN ('sheets', 'excel_fallback', 'offer_sheet', 'offer_pdf'));
