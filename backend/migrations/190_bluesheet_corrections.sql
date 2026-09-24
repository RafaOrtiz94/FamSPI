-- Migration 190: Correcciones al schema del Análisis Estratégico (Bluesheet)
-- Problemas que corrige:
--   1. opportunity: agrega campos faltantes del Excel (empresa_area, objetivo declarado, etc.)
--   2. opportunity_rating: reemplaza BOOLEAN con S/N/D y corrige los 5 criterios del Excel
--   3. buying_influence: agrega calificacion (-5..+5) y preferencia_competitiva
--   4. opportunity_flag: agrega flag_type para separar Puntos Fuertes de Banderas Rojas
--   5. competitor: corrige rango de scores de 0-10 a -5..+5, renombra evidence→timing

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABLA opportunity — campos faltantes del Excel
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE opportunity
  ADD COLUMN IF NOT EXISTS empresa_area TEXT,
  ADD COLUMN IF NOT EXISTS objetivo_declarado_cliente TEXT,
  ADD COLUMN IF NOT EXISTS efectos_evaluacion TEXT,
  ADD COLUMN IF NOT EXISTS competencia_resumen TEXT,
  ADD COLUMN IF NOT EXISTS periodo_anos SMALLINT NOT NULL DEFAULT 1
    CHECK (periodo_anos >= 1),
  ADD COLUMN IF NOT EXISTS tiempo_cliente_prioridades TEXT
    CHECK (tiempo_cliente_prioridades IN ('urgente','activo','importante','posteriormente'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TABLA opportunity_rating — reemplazar BOOLEAN con S/N/D
--    Los 5 criterios del Excel son:
--      · Existe suficiente presupuesto
--      · Tenemos el acceso que necesitamos
--      · Tenemos un claro entendimiento del proceso de compra del cliente
--      · Tenemos una relación fuerte con la IC Económica
--      · Tenemos por lo menos un Coach
-- ─────────────────────────────────────────────────────────────────────────────

-- Paso A: eliminar columna generada primero (depende de las BOOLEAN)
ALTER TABLE opportunity_rating DROP COLUMN IF EXISTS total_score;

-- Paso B: eliminar las columnas BOOLEAN incorrectas
ALTER TABLE opportunity_rating DROP COLUMN IF EXISTS has_economic_buyer;
ALTER TABLE opportunity_rating DROP COLUMN IF EXISTS has_competition_strategy;
ALTER TABLE opportunity_rating DROP COLUMN IF EXISTS has_red_flag_mitigation;
ALTER TABLE opportunity_rating DROP COLUMN IF EXISTS has_clear_objective;
ALTER TABLE opportunity_rating DROP COLUMN IF EXISTS has_coach;

-- Paso C: agregar los 5 criterios correctos como S/N/D
ALTER TABLE opportunity_rating
  ADD COLUMN IF NOT EXISTS tiene_presupuesto TEXT NOT NULL DEFAULT 'D'
    CHECK (tiene_presupuesto IN ('S','N','D')),
  ADD COLUMN IF NOT EXISTS tiene_acceso TEXT NOT NULL DEFAULT 'D'
    CHECK (tiene_acceso IN ('S','N','D')),
  ADD COLUMN IF NOT EXISTS entiende_proceso_compra TEXT NOT NULL DEFAULT 'D'
    CHECK (entiende_proceso_compra IN ('S','N','D')),
  ADD COLUMN IF NOT EXISTS relacion_con_eb TEXT NOT NULL DEFAULT 'D'
    CHECK (relacion_con_eb IN ('S','N','D')),
  ADD COLUMN IF NOT EXISTS tiene_coach TEXT NOT NULL DEFAULT 'D'
    CHECK (tiene_coach IN ('S','N','D'));

-- Paso D: agregar columna generada con la puntuación (cada S = 20 pts, máx 100)
ALTER TABLE opportunity_rating
  ADD COLUMN IF NOT EXISTS puntuacion INTEGER GENERATED ALWAYS AS (
    (CASE WHEN tiene_presupuesto      = 'S' THEN 20 ELSE 0 END) +
    (CASE WHEN tiene_acceso           = 'S' THEN 20 ELSE 0 END) +
    (CASE WHEN entiende_proceso_compra = 'S' THEN 20 ELSE 0 END) +
    (CASE WHEN relacion_con_eb        = 'S' THEN 20 ELSE 0 END) +
    (CASE WHEN tiene_coach            = 'S' THEN 20 ELSE 0 END)
  ) STORED;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TABLA buying_influence — agregar calificacion y preferencia competitiva
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE buying_influence
  ADD COLUMN IF NOT EXISTS calificacion SMALLINT NOT NULL DEFAULT 0
    CHECK (calificacion BETWEEN -5 AND 5),
  ADD COLUMN IF NOT EXISTS preferencia_competitiva TEXT NOT NULL DEFAULT 'neutral'
    CHECK (preferencia_competitiva IN ('a_favor','neutral','en_contra'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. TABLA opportunity_flag — separar Puntos Fuertes de Banderas Rojas
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE opportunity_flag
  ADD COLUMN IF NOT EXISTS flag_type TEXT NOT NULL DEFAULT 'bandera_roja'
    CHECK (flag_type IN ('bandera_roja','punto_fuerte'));

-- Las flags auto-generadas por el trigger de euforia siempre son banderas rojas
UPDATE opportunity_flag
  SET flag_type = 'bandera_roja'
  WHERE auto_generated = TRUE AND flag_type = 'bandera_roja';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. TABLA competitor — corregir rango 0-10 → -5..+5 y renombrar evidence→timing
-- ─────────────────────────────────────────────────────────────────────────────

-- Paso A: eliminar constraints CHECK existentes (0-10)
ALTER TABLE competitor DROP CONSTRAINT IF EXISTS competitor_relationship_score_check;
ALTER TABLE competitor DROP CONSTRAINT IF EXISTS competitor_technical_score_check;
ALTER TABLE competitor DROP CONSTRAINT IF EXISTS competitor_price_score_check;
ALTER TABLE competitor DROP CONSTRAINT IF EXISTS competitor_service_score_check;
ALTER TABLE competitor DROP CONSTRAINT IF EXISTS competitor_evidence_score_check;

-- Paso B: resetear valores al punto medio del nuevo rango (0 = empate)
UPDATE competitor SET
  relationship_score = 0,
  technical_score    = 0,
  price_score        = 0,
  service_score      = 0,
  evidence_score     = 0;

-- Paso C: agregar nuevos constraints -5..+5
ALTER TABLE competitor
  ADD CONSTRAINT competitor_relationship_score_check
    CHECK (relationship_score BETWEEN -5 AND 5),
  ADD CONSTRAINT competitor_technical_score_check
    CHECK (technical_score BETWEEN -5 AND 5),
  ADD CONSTRAINT competitor_price_score_check
    CHECK (price_score BETWEEN -5 AND 5),
  ADD CONSTRAINT competitor_service_score_check
    CHECK (service_score BETWEEN -5 AND 5),
  ADD CONSTRAINT competitor_evidence_score_check
    CHECK (evidence_score BETWEEN -5 AND 5);

-- Paso D: renombrar evidence_score → timing_score (el 5.º eje del Excel es Timing, no Evidencia)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'competitor' AND column_name = 'evidence_score'
  ) THEN
    ALTER TABLE competitor RENAME COLUMN evidence_score TO timing_score;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. TABLA opportunity_rating — trigger updated_at (faltaba en migración original)
-- ─────────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_opportunity_rating_touch_updated_at ON opportunity_rating;
CREATE TRIGGER trg_opportunity_rating_touch_updated_at
  BEFORE UPDATE ON opportunity_rating
  FOR EACH ROW
  EXECUTE FUNCTION bs_touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. ACTUALIZAR TRIGGER euforia-pánico para incluir flag_type
--    (en la migración 189 el INSERT no establecía flag_type; ahora DEFAULT 'bandera_roja'
--     lo cubre automáticamente, pero se actualiza la función para ser explícito)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION bs_handle_euphoria_red_flag()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.euphoria_panic >= 7 THEN
    INSERT INTO opportunity_flag (
      opportunity_id,
      buying_influence_id,
      flag_type,
      title,
      description,
      severity,
      status,
      auto_generated,
      created_by,
      updated_by
    )
    SELECT
      NEW.opportunity_id,
      NEW.id,
      'bandera_roja',
      'Euforia/pánico alto',
      CONCAT(
        'La influencia compradora "', NEW.full_name,
        '" registra euforia/pánico ', NEW.euphoria_panic, '/10.'
      ),
      'high',
      'open',
      TRUE,
      NEW.created_by,
      NEW.updated_by
    WHERE NOT EXISTS (
      SELECT 1 FROM opportunity_flag existing
      WHERE existing.buying_influence_id = NEW.id
        AND existing.auto_generated      = TRUE
        AND existing.title               = 'Euforia/pánico alto'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
