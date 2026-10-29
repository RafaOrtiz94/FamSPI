-- Migration 330: escenarios aceptados de la calibracion de la simulacion contra cantidades reales.
--
-- Por cada Business Case y equipo con cantidades reales (PRODUCTO A ENTREGAR del Sheet sin valores
-- de relleno, o lo validado por jefe_servicio) se corren muchos escenarios y solo se guardan los que
-- mas se acercaron a lo real (consumableCalibration.js). Las predicciones de otros Business Case se
-- sortean entre estos escenarios. Una fila por Business Case y equipo: la ultima calibracion reemplaza.

CREATE TABLE IF NOT EXISTS public.bc_scenario_calibrations (
  business_case_id UUID NOT NULL REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE,
  equipment_id INTEGER NOT NULL,
  equipment_code TEXT,
  real_fingerprint TEXT NOT NULL,
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  accepted JSONB NOT NULL DEFAULT '[]'::jsonb,
  scenarios INTEGER NOT NULL DEFAULT 0,
  comparable_products INTEGER NOT NULL DEFAULT 0,
  best_distance NUMERIC,
  accepted_median_distance NUMERIC,
  prior_median_distance NUMERIC,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (business_case_id, equipment_id)
);

COMMENT ON TABLE public.bc_scenario_calibrations IS
  'Escenarios de simulacion que mas se acercaron a las cantidades reales de cada Business Case; base de las predicciones de los demas.';
