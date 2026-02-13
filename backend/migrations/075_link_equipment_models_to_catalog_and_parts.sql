/**
 * Migration: 075_link_equipment_models_to_catalog_and_parts.sql
 * Goal:
 * - Link equipment_models to servicio.equipos so we can expose determinations/consumables/reactivos per model.
 * - Provide views for equipment_models -> determinations/consumables/reactivos.
 * - Add maintenance parts per equipment (6m / 12m) where each part belongs to a single equipment model.
 */

-- 1) Add link column from equipment_models to servicio.equipos
ALTER TABLE public.equipment_models
  ADD COLUMN IF NOT EXISTS servicio_equipo_id integer;

-- 2) Populate servicio_equipo_id by matching (code/model/name)
WITH matches AS (
  SELECT
    em.id AS equipment_model_id,
    se.id_equipo AS servicio_equipo_id,
    ROW_NUMBER() OVER (
      PARTITION BY em.id
      ORDER BY
        (em.code IS NOT NULL AND se.code IS NOT NULL AND em.code = se.code) DESC,
        (em.model IS NOT NULL AND se.modelo IS NOT NULL AND em.model = se.modelo) DESC,
        (em.name IS NOT NULL AND se.nombre IS NOT NULL AND lower(em.name) = lower(se.nombre)) DESC,
        se.id_equipo
    ) AS rn
  FROM public.equipment_models em
  LEFT JOIN servicio.equipos se
    ON (em.code IS NOT NULL AND se.code IS NOT NULL AND em.code = se.code)
    OR (em.model IS NOT NULL AND se.modelo IS NOT NULL AND em.model = se.modelo)
    OR (em.name IS NOT NULL AND se.nombre IS NOT NULL AND lower(em.name) = lower(se.nombre))
)
UPDATE public.equipment_models em
SET servicio_equipo_id = matches.servicio_equipo_id
FROM matches
WHERE em.id = matches.equipment_model_id
  AND matches.rn = 1
  AND em.servicio_equipo_id IS NULL;

-- 3) Add FK constraint if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'equipment_models_servicio_equipo_id_fkey'
  ) THEN
    ALTER TABLE public.equipment_models
      ADD CONSTRAINT equipment_models_servicio_equipo_id_fkey
      FOREIGN KEY (servicio_equipo_id)
      REFERENCES servicio.equipos(id_equipo)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 4) Views to expose determinations/consumables/reactivos for equipment_models
CREATE OR REPLACE VIEW public.v_equipment_model_determinations AS
SELECT
  em.id AS equipment_model_id,
  em.name AS equipment_name,
  d.id AS determination_id,
  d.name AS determination_name,
  d.category,
  d.roche_code,
  d.status
FROM public.equipment_models em
JOIN catalog_determinations d
  ON d.equipment_id = em.servicio_equipo_id;

CREATE OR REPLACE VIEW public.v_equipment_model_consumables AS
SELECT
  em.id AS equipment_model_id,
  em.name AS equipment_name,
  c.id AS consumable_id,
  c.name AS consumable_name,
  c.type AS consumable_type,
  c.status,
  ec.consumption_rate,
  ec.determination_id
FROM public.equipment_models em
JOIN catalog_equipment_consumables ec
  ON ec.equipment_id = em.servicio_equipo_id
JOIN catalog_consumables c
  ON c.id = ec.consumable_id;

CREATE OR REPLACE VIEW public.v_equipment_model_reactives AS
SELECT *
FROM public.v_equipment_model_consumables
WHERE consumable_type = 'reactivo';

-- 5) Maintenance parts per equipment model (6m / 12m)
CREATE TABLE IF NOT EXISTS public.equipment_maintenance_parts (
  id serial PRIMARY KEY,
  equipment_model_id integer NOT NULL REFERENCES public.equipment_models(id) ON DELETE CASCADE,
  part_code character varying(100),
  part_name character varying(255) NOT NULL,
  maintenance_interval_months integer NOT NULL CHECK (maintenance_interval_months IN (6, 12)),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_parts_equipment
  ON public.equipment_maintenance_parts (equipment_model_id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_equipment_part_per_model
  ON public.equipment_maintenance_parts (equipment_model_id, part_code, part_name);

COMMENT ON TABLE public.equipment_maintenance_parts IS 'Piezas de mantenimiento por equipo (6 y 12 meses). Cada pieza pertenece a un equipo.';
