-- Migration 327: historico de simulaciones de escenarios de consumibles.
--
-- Cada fila es una corrida (Monte Carlo, minimo 5000 escenarios) para un Business Case y equipo,
-- con el perfil estadistico del cliente y la huella de los datos de entrada. Las corridas
-- automaticas (trigger = 'auto') se generan solas cuando cambian las estadisticas del cliente
-- (job bc_consumable_simulations / POST /internal/jobs/business-case/consumable-simulations);
-- nunca se borran: son el historico que usa el motor para predecir a clientes parecidos.
-- equipment_id = 0 marca un Business Case evaluado sin modelo simulable (para no reintentar).
-- Modo sombra: no escribe en la oferta ni en el consumo del Business Case.

CREATE TABLE IF NOT EXISTS public.bc_consumable_simulations (
  id BIGSERIAL PRIMARY KEY,
  business_case_id UUID NOT NULL REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE,
  equipment_id INTEGER NOT NULL,
  equipment_code TEXT,
  input_fingerprint TEXT,
  trigger VARCHAR(16) NOT NULL DEFAULT 'auto' CHECK (trigger IN ('auto', 'manual')),
  engine_version TEXT,
  scenarios INTEGER NOT NULL DEFAULT 0,
  seed BIGINT NOT NULL DEFAULT 0,
  conventions JSONB NOT NULL DEFAULT '{}'::jsonb,
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  duration_ms INTEGER,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bc_consumable_simulations_case
  ON public.bc_consumable_simulations (business_case_id, equipment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bc_consumable_simulations_equipment
  ON public.bc_consumable_simulations (equipment_code, trigger, created_at DESC);

COMMENT ON TABLE public.bc_consumable_simulations IS
  'Historico de simulaciones de escenarios de consumibles por Business Case y equipo (automaticas y manuales), con el perfil estadistico del cliente. Laboratorio de calculo, modo sombra.';
