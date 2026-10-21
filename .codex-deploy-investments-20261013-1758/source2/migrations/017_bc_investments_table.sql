--
-- Migration 017: Tabla bc_investments para registrar inversiones adicionales
--

CREATE TABLE IF NOT EXISTS public.bc_investments (
  id serial PRIMARY KEY,
  business_case_id uuid NOT NULL REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE,
  concept character varying(255) NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  investment_type character varying(50) NOT NULL CHECK (investment_type IN ('one_time', 'recurring_monthly', 'recurring_annual')),
  category character varying(100),
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bc_investments_bc ON public.bc_investments (business_case_id);

COMMENT ON TABLE public.bc_investments IS 'Inversiones adicionales asociadas a un Business Case moderno';
COMMENT ON COLUMN public.bc_investments.investment_type IS 'Tipo de inversión: one_time, recurring_monthly o recurring_annual';
COMMENT ON COLUMN public.bc_investments.category IS 'Categoría sugerida: installation, training, transport, maintenance, other';
