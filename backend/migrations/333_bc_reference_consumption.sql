-- Migration 333: consumo real de procesos de referencia que no son Business Case del sistema.
--
-- Cada fila es el consumo real por mes de un producto en un proceso real (ej. HJMVI Tena: registro
-- de consumibles con entregas y lecturas de stock). El motor predice a los clientes nuevos con estas
-- tasas y con las de bc_delivery_history de otros Business Case (referenceConsumption.js).
-- Se carga con: node scripts/consumable-prediction/verifyCases.js --load (reemplaza las filas del caso).

CREATE TABLE IF NOT EXISTS public.bc_reference_consumption (
  source_name TEXT NOT NULL,
  item_type VARCHAR(16) NOT NULL CHECK (item_type IN ('calibrador', 'control', 'material')),
  supplier_code TEXT NOT NULL,
  product_name TEXT NOT NULL,
  module VARCHAR(16),
  per_month NUMERIC NOT NULL CHECK (per_month >= 0),
  months_measured NUMERIC,
  source_file TEXT,
  loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source_name, item_type, supplier_code)
);

COMMENT ON TABLE public.bc_reference_consumption IS
  'Consumo real por mes de procesos de referencia (fuera del sistema) para predecir clientes nuevos.';
