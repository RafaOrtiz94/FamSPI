-- Migration 331: estadisticas del laboratorio ajustadas por simulacion.
--
-- Cuando un Business Case tiene cantidades reales (PRODUCTO A ENTREGAR o validaciones), la
-- simulacion busca las estadisticas del laboratorio (muestras ISE por año, % de repeticiones, % de
-- controles fuera de rango) que dan mas coincidencias con lo real (labStatisticsSearch.js).
-- - bc_lab_statistics.source: 'laboratory' (lo llena jefe_servicio, siempre manda) o
--   'simulation_fit' (resultado de la busqueda; se reemplaza en cada busqueda nueva).
-- - bc_lab_statistics_search: cada candidato evaluado. Los descartados no se vuelven a simular
--   mientras lo real no cambie (real_fingerprint).

ALTER TABLE public.bc_lab_statistics
  ADD COLUMN IF NOT EXISTS source VARCHAR(24) NOT NULL DEFAULT 'laboratory',
  ADD COLUMN IF NOT EXISTS details JSONB;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bc_lab_statistics_source_check') THEN
    ALTER TABLE public.bc_lab_statistics
      ADD CONSTRAINT bc_lab_statistics_source_check CHECK (source IN ('laboratory', 'simulation_fit'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.bc_lab_statistics_search (
  id BIGSERIAL PRIMARY KEY,
  business_case_id UUID NOT NULL REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE,
  equipment_id INTEGER NOT NULL,
  real_fingerprint TEXT NOT NULL,
  round INTEGER NOT NULL,
  params JSONB NOT NULL,
  matches INTEGER NOT NULL,
  error NUMERIC,
  status VARCHAR(12) NOT NULL CHECK (status IN ('elite', 'discarded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bc_lab_statistics_search_case
  ON public.bc_lab_statistics_search (business_case_id, equipment_id, real_fingerprint, status);
