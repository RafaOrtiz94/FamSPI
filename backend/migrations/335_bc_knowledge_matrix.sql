-- Migration 335: matriz de conocimiento de jefe_servicio.
--
-- Cada justificacion de una diferencia con PRODUCTO A ENTREGAR deja un dato puntual: un motivo y un
-- numero (consumo por mes, analizadores, extra por entrega, stock del cliente o decision comercial).
-- Los motivos transferibles se reutilizan para predecir procesos nuevos (knowledgeMatrix.js).
-- Una fila por Business Case, equipo y producto: la ultima justificacion reemplaza a la anterior.

CREATE TABLE IF NOT EXISTS public.bc_knowledge_matrix (
  business_case_id UUID NOT NULL REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE,
  equipment_id INTEGER NOT NULL,
  equipment_code TEXT,
  item_type VARCHAR(16) NOT NULL CHECK (item_type IN ('calibrador', 'control', 'material')),
  supplier_code TEXT NOT NULL,
  product_name TEXT,
  reason VARCHAR(32) NOT NULL CHECK (reason IN ('monthly_consumption', 'analyzers', 'extra_per_delivery', 'client_stock', 'commercial')),
  value NUMERIC,
  quantity NUMERIC NOT NULL,
  process_months NUMERIC,
  partial_deliveries INTEGER,
  transferable BOOLEAN NOT NULL DEFAULT FALSE,
  note TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (business_case_id, equipment_id, item_type, supplier_code)
);

CREATE INDEX IF NOT EXISTS idx_bc_knowledge_matrix_transferable
  ON public.bc_knowledge_matrix (equipment_code, item_type, supplier_code) WHERE transferable;

COMMENT ON TABLE public.bc_knowledge_matrix IS
  'Justificaciones estructuradas de jefe_servicio (motivo + dato) reutilizables para predecir procesos nuevos.';
