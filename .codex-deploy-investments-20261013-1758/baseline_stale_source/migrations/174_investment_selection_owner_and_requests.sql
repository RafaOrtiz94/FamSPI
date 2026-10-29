-- Ownership + quantity change requests for BC investment selections

ALTER TABLE public.bc_investment_selections
  ADD COLUMN IF NOT EXISTS owner_email text,
  ADD COLUMN IF NOT EXISTS owner_role text;

UPDATE public.bc_investment_selections
SET owner_email = COALESCE(NULLIF(owner_email, ''), updated_by_email),
    owner_role = COALESCE(NULLIF(owner_role, ''), updated_by_role)
WHERE owner_email IS NULL OR owner_role IS NULL;

CREATE TABLE IF NOT EXISTS public.bc_investment_selection_requests (
  id BIGSERIAL PRIMARY KEY,
  business_case_id uuid NOT NULL REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE,
  catalog_id integer NOT NULL REFERENCES public.bc_investment_catalog(id) ON DELETE CASCADE,
  request_type text NOT NULL DEFAULT 'increase_quantity',
  requested_quantity numeric,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  requested_by_email text,
  requested_by_role text,
  resolved_by_email text,
  resolved_by_role text,
  resolution_notes text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_bc_inv_sel_req_type CHECK (request_type IN ('increase_quantity')),
  CONSTRAINT chk_bc_inv_sel_req_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_bc_inv_sel_req_bc_catalog
  ON public.bc_investment_selection_requests (business_case_id, catalog_id);

CREATE INDEX IF NOT EXISTS idx_bc_inv_sel_req_pending
  ON public.bc_investment_selection_requests (business_case_id, status)
  WHERE status = 'pending';

