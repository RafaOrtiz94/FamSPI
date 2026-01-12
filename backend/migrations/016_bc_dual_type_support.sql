--
-- Migration 016: Campos adicionales para Business Case dual (público/privado)
--

ALTER TABLE public.equipment_purchase_requests
  ADD COLUMN IF NOT EXISTS bc_purchase_type character varying(50) DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS bc_duration_years integer,
  ADD COLUMN IF NOT EXISTS bc_equipment_cost numeric(12,2),
  ADD COLUMN IF NOT EXISTS bc_target_margin_percentage numeric(5,2),
  ADD COLUMN IF NOT EXISTS bc_amortization_months integer,
  ADD COLUMN IF NOT EXISTS bc_calculation_mode character varying(20) DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS bc_show_roi boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS bc_show_margin boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS equipment_purchase_requests_bc_purchase_type_idx
  ON public.equipment_purchase_requests (bc_purchase_type);

COMMENT ON COLUMN public.equipment_purchase_requests.bc_purchase_type IS 'Tipo de Business Case: public, private_comodato o private_sale';
COMMENT ON COLUMN public.equipment_purchase_requests.bc_duration_years IS 'Duración del comodato en años (solo para privados)';
COMMENT ON COLUMN public.equipment_purchase_requests.bc_equipment_cost IS 'Costo del equipo utilizado para cálculos de ROI';
COMMENT ON COLUMN public.equipment_purchase_requests.bc_target_margin_percentage IS 'Margen objetivo (%) para cálculos privados';
COMMENT ON COLUMN public.equipment_purchase_requests.bc_amortization_months IS 'Meses de amortización estimados';
COMMENT ON COLUMN public.equipment_purchase_requests.bc_calculation_mode IS 'Modo de cálculo: monthly o annual';
COMMENT ON COLUMN public.equipment_purchase_requests.bc_show_roi IS 'Flag para mostrar ROI en reportes';
COMMENT ON COLUMN public.equipment_purchase_requests.bc_show_margin IS 'Flag para mostrar margen en reportes';
