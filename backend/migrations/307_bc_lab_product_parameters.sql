-- Migration 307: ajustes del laboratorio por producto en Entorno Laboratorio.
-- Requiere 305_catalog_consumable_specs.sql.
--
-- Entorno Laboratorio muestra, por cada producto del Business Case, los
-- parametros del fabricante (catalog_consumable_specs: frecuencia de
-- calibracion, intervalo de control, estabilidad abierto/a bordo). Si el
-- laboratorio trabaja distinto, el ajuste se guarda aqui; solo se persisten
-- los campos que difieren del fabricante. El motor de calculo usa
-- ajuste ?? fabricante.
--
-- overrides admite: calibration_interval_days, qc_interval_hours,
-- onboard_days, open_days (numeros > 0) y note (texto).

CREATE TABLE IF NOT EXISTS public.bc_lab_product_parameters (
  business_case_id UUID NOT NULL REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE,
  supplier_code VARCHAR(32) NOT NULL,
  overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (business_case_id, supplier_code)
);

COMMENT ON TABLE public.bc_lab_product_parameters IS
  'Ajustes del laboratorio sobre la ficha del fabricante (catalog_consumable_specs), por Business Case y producto. Seccion Entorno Laboratorio.';
