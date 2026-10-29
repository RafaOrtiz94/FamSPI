-- 283_opportunity_rating_manual_criteria.sql
-- Agrega almacenamiento para los 5 criterios manuales (S/N/D) que el frontend de
-- FamSheets (OpportunityWorkspace.jsx, tab "Valoración") captura por oportunidad.
--
-- `opportunity_rating.total_score` es GENERATED ALWAYS a partir de señales reales
-- (has_economic_buyer, has_coach, has_competition_strategy, has_red_flag_mitigation,
-- has_clear_objective) calculadas por refreshRating() — no se puede ni se debe
-- escribir directo sobre esa columna. Los criterios manuales se guardan aparte,
-- como dato informativo/de seguimiento comercial, sin alterar el cálculo real.

ALTER TABLE opportunity_rating
  ADD COLUMN IF NOT EXISTS manual_criteria JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN opportunity_rating.manual_criteria IS
  'Criterios de valoracion manual (S/N/D) capturados desde el tab Valoracion de FamSheets. No participa en el calculo de total_score (columna GENERATED), es solo registro informativo.';
