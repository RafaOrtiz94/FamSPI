-- Migration 260: quotation assignment and financial depreciation per investment item

ALTER TABLE public.bc_investment_selections
  ADD COLUMN IF NOT EXISTS quotation_assignee_id INTEGER,
  ADD COLUMN IF NOT EXISTS quotation_assignee_email TEXT,
  ADD COLUMN IF NOT EXISTS quotation_assignee_name TEXT,
  ADD COLUMN IF NOT EXISTS quotation_status TEXT NOT NULL DEFAULT 'not_requested',
  ADD COLUMN IF NOT EXISTS quotation_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS quotation_requested_by INTEGER,
  ADD COLUMN IF NOT EXISTS quotation_requested_by_email TEXT,
  ADD COLUMN IF NOT EXISTS depreciation_percentage NUMERIC(5,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bc_investment_selections_quotation_status_check'
      AND conrelid = 'public.bc_investment_selections'::regclass
  ) THEN
    ALTER TABLE public.bc_investment_selections
      ADD CONSTRAINT bc_investment_selections_quotation_status_check
      CHECK (quotation_status IN ('not_requested', 'requested', 'received'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bc_investment_selections_depreciation_percentage_check'
      AND conrelid = 'public.bc_investment_selections'::regclass
  ) THEN
    ALTER TABLE public.bc_investment_selections
      ADD CONSTRAINT bc_investment_selections_depreciation_percentage_check
      CHECK (depreciation_percentage IS NULL OR (depreciation_percentage >= 0 AND depreciation_percentage <= 100));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bc_investment_selections_quotation_assignee_fkey'
      AND conrelid = 'public.bc_investment_selections'::regclass
  ) THEN
    ALTER TABLE public.bc_investment_selections
      ADD CONSTRAINT bc_investment_selections_quotation_assignee_fkey
      FOREIGN KEY (quotation_assignee_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bc_investment_selections_quotation_requested_by_fkey'
      AND conrelid = 'public.bc_investment_selections'::regclass
  ) THEN
    ALTER TABLE public.bc_investment_selections
      ADD CONSTRAINT bc_investment_selections_quotation_requested_by_fkey
      FOREIGN KEY (quotation_requested_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bc_investment_selections_quotation_assignee
  ON public.bc_investment_selections (quotation_assignee_id, quotation_status)
  WHERE selected = true;

COMMENT ON COLUMN public.bc_investment_selections.depreciation_percentage
  IS 'Depreciacion financiera del item, expresada como porcentaje entre 0 y 100';
COMMENT ON COLUMN public.bc_investment_selections.quotation_status
  IS 'Estado de la solicitud de cotizacion del item';
