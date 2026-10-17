-- 121_bc_calculations_win_probability.sql
-- Columnas para motor de probabilidad de exito (BI)

ALTER TABLE public.bc_calculations
ADD COLUMN IF NOT EXISTS win_probability numeric(5,2),
ADD COLUMN IF NOT EXISTS scoring_metadata jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_bc_calculations_win_probability
  ON public.bc_calculations (win_probability DESC NULLS LAST);

COMMENT ON COLUMN public.bc_calculations.win_probability IS 'Score predictivo de probabilidad de exito del Business Case (0-100)';
COMMENT ON COLUMN public.bc_calculations.scoring_metadata IS 'Desglose JSON de factores y reglas usadas para calcular win_probability';
