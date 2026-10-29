-- Archivos de cotizacion por item de inversiones adicionales del Business Case.
-- El cotizador asignado sube 1..n cotizaciones; jefe_financiero registra el valor.
-- Tambien se crea en runtime desde investments.service.js (ensureQuotationFilesTable).
CREATE TABLE IF NOT EXISTS public.bc_investment_quotation_files (
  id                BIGSERIAL PRIMARY KEY,
  business_case_id  UUID        NOT NULL REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE,
  catalog_id        INTEGER     NOT NULL REFERENCES public.bc_investment_catalog(id) ON DELETE CASCADE,
  file_name         TEXT        NOT NULL,
  mime_type         TEXT,
  size_bytes        INTEGER,
  drive_file_id     TEXT        NOT NULL,
  drive_url         TEXT,
  uploaded_by       INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  uploaded_by_email TEXT,
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  active            BOOLEAN     NOT NULL DEFAULT true,
  removed_at        TIMESTAMPTZ,
  removed_by_email  TEXT
);

CREATE INDEX IF NOT EXISTS idx_bc_investment_quotation_files_item
  ON public.bc_investment_quotation_files (business_case_id, catalog_id) WHERE active = true;
