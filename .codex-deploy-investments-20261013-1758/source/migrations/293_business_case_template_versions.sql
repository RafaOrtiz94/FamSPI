-- Versionado de la plantilla base del Business Case (hoja de Excel/Sheets
-- que se copia para cada BC nuevo). Solo jefe_comercial puede subir una
-- version nueva; el sistema parsea su estructura (pestañas + encabezados)
-- y genera un reporte de diferencias contra la version activa para que
-- jefe_comercial confirme antes de activarla.

CREATE TABLE IF NOT EXISTS public.business_case_template_versions (
  id BIGSERIAL PRIMARY KEY,
  filename TEXT NOT NULL,
  xlsx_drive_file_id TEXT NOT NULL,
  xlsx_drive_url TEXT,
  xlsx_sha256 TEXT NOT NULL,
  sheet_drive_file_id TEXT NOT NULL,
  sheet_drive_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'active', 'superseded', 'rejected')),
  structure_snapshot JSONB NOT NULL,
  diff_report JSONB,
  uploaded_by INTEGER REFERENCES public.users(id),
  uploaded_by_name TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_by INTEGER REFERENCES public.users(id),
  activated_at TIMESTAMPTZ,
  rejected_by INTEGER REFERENCES public.users(id),
  rejected_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bc_template_versions_status
  ON public.business_case_template_versions (status);
-- Solo puede haber una version activa a la vez.
CREATE UNIQUE INDEX IF NOT EXISTS ux_bc_template_versions_single_active
  ON public.business_case_template_versions ((1)) WHERE status = 'active';
