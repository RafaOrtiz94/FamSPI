-- Migration 332: historial de entregas reales del proceso anterior del mismo cliente.
--
-- Es la verdad del motor de consumibles: lo que realmente se entrego (control de consumibles
-- entregados), no PRODUCTO A ENTREGAR del Sheet, que es el calculo del especialista para el proceso.
-- Se carga desde Determinaciones con el archivo de control de entregas. Una fila por Business Case,
-- tipo y codigo (o nombre si el producto no tiene codigo); la ultima carga reemplaza a la anterior.

CREATE TABLE IF NOT EXISTS public.bc_delivery_history (
  business_case_id UUID NOT NULL REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  item_type VARCHAR(16) NOT NULL CHECK (item_type IN ('calibrador', 'control', 'material')),
  supplier_code TEXT,
  product_name TEXT NOT NULL,
  sheet_area TEXT,
  units_per_box NUMERIC NOT NULL DEFAULT 1,
  delivered_units NUMERIC NOT NULL CHECK (delivered_units >= 0),
  delivered_boxes NUMERIC NOT NULL CHECK (delivered_boxes >= 0),
  contracted_boxes NUMERIC,
  period_start DATE,
  period_end DATE,
  period_months NUMERIC,
  deliveries JSONB NOT NULL DEFAULT '[]'::jsonb,
  stock JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_file TEXT,
  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (business_case_id, item_key)
);

COMMENT ON TABLE public.bc_delivery_history IS
  'Entregas reales del proceso anterior del cliente (control de consumibles entregados); verdad para calibrar y predecir.';
