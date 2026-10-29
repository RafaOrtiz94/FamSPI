-- Migration 326: cantidades reales contra las que se mide el motor de reglas de consumibles.
--
-- Cada fila es un caso: para un producto de un equipo de un Business Case, la cantidad correcta
-- (validated_qty) y lo que el motor predecia en ese momento (predicted_qty, con su fuente y sus
-- convenciones). Dos origenes:
--   expert   -> la valida o corrige una persona en el laboratorio de calculo;
--   dispatch -> lo realmente despachado en un proceso cerrado (scripts/learn_consumable_rules_from_dispatch.js).
-- Con estas filas se calcula la exactitud del motor y el factor de ajuste por producto y equipo.
-- El motor sigue en modo sombra: esta tabla no escribe en la oferta ni en el consumo del BC.

CREATE TABLE IF NOT EXISTS public.bc_consumable_rule_validations (
  id BIGSERIAL PRIMARY KEY,
  business_case_id UUID NOT NULL REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE,
  equipment_id INTEGER NOT NULL,
  equipment_code TEXT,
  item_type VARCHAR(32) NOT NULL,
  supplier_code VARCHAR(32) NOT NULL,
  origin VARCHAR(16) NOT NULL DEFAULT 'expert' CHECK (origin IN ('expert', 'dispatch')),
  validated_qty NUMERIC NOT NULL CHECK (validated_qty >= 0),
  predicted_qty NUMERIC,
  predicted_source VARCHAR(32),
  conventions JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  validated_by TEXT,
  validated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_case_id, equipment_id, item_type, supplier_code, origin)
);

CREATE INDEX IF NOT EXISTS idx_bc_consumable_rule_validations_product
  ON public.bc_consumable_rule_validations (equipment_code, item_type, supplier_code);

COMMENT ON TABLE public.bc_consumable_rule_validations IS
  'Casos validados (experto o despacho real) para medir y ajustar el motor de reglas de consumibles. Laboratorio de calculo, modo sombra.';
