BEGIN;

ALTER TABLE permisos_vacaciones
  ADD COLUMN IF NOT EXISTS subtipo_salud TEXT,
  ADD COLUMN IF NOT EXISTS recovery_plan JSONB,
  ADD COLUMN IF NOT EXISTS recovery_plan_total_hours DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS recovery_plan_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recovery_plan_updated_by_user_id INTEGER;

ALTER TABLE permisos_vacaciones
  DROP CONSTRAINT IF EXISTS permisos_vacaciones_subtipo_salud_check;

UPDATE permisos_vacaciones
   SET subtipo_salud = 'enfermedad_certificada'
 WHERE tipo_permiso = 'salud'
   AND (subtipo_salud IS NULL OR length(trim(subtipo_salud)) = 0);

ALTER TABLE permisos_vacaciones
  ADD CONSTRAINT permisos_vacaciones_subtipo_salud_check
  CHECK (
    (tipo_permiso = 'salud' AND subtipo_salud IS NOT NULL AND length(trim(subtipo_salud)) > 0)
    OR tipo_permiso != 'salud'
  );

CREATE INDEX IF NOT EXISTS idx_permisos_recovery_plan_updated_at
  ON permisos_vacaciones (recovery_plan_updated_at DESC)
  WHERE recovery_plan IS NOT NULL;

COMMIT;
