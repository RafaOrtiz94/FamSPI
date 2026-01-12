--
-- Migration 019: BC Investments Table
-- Manages additional investments for Business Cases
--

CREATE TABLE IF NOT EXISTS public.bc_investments (
    id serial PRIMARY KEY,
    business_case_id uuid NOT NULL REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE,
    
    -- Investment details
    concept varchar(255) NOT NULL,
    amount numeric(12,2) NOT NULL CHECK (amount >= 0),
    investment_type varchar(50) NOT NULL CHECK (investment_type IN ('one_time', 'recurring_monthly', 'recurring_annual')),
    category varchar(100) CHECK (category IN ('installation', 'training', 'transport', 'maintenance', 'other')),
    notes text,
    
    -- Audit
    created_at timestamp with time zone DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS bc_investments_business_case_id_idx 
    ON public.bc_investments (business_case_id);
    
CREATE INDEX IF NOT EXISTS bc_investments_investment_type_idx 
    ON public.bc_investments (investment_type);
    
CREATE INDEX IF NOT EXISTS bc_investments_category_idx 
    ON public.bc_investments (category);

-- Comments
COMMENT ON TABLE public.bc_investments IS 'Inversiones adicionales asociadas a un Business Case (instalación, capacitación, etc.)';
COMMENT ON COLUMN public.bc_investments.investment_type IS 'Tipo: one_time (pago único), recurring_monthly (mensual), recurring_annual (anual)';
COMMENT ON COLUMN public.bc_investments.category IS 'Categoría: installation, training, transport, maintenance, other';
COMMENT ON COLUMN public.bc_investments.amount IS 'Monto de la inversión';
