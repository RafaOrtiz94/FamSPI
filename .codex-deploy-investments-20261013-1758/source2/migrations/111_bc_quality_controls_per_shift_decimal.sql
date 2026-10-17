-- Permite decimales en controles de calidad por turno
-- Impacta formulario de entorno de laboratorio y dominio operacional unificado

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bc_lab_environment'
      AND column_name = 'quality_controls_per_shift'
  ) THEN
    ALTER TABLE public.bc_lab_environment
      ALTER COLUMN quality_controls_per_shift TYPE numeric(6,2)
      USING quality_controls_per_shift::numeric;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bc_operational_data'
      AND column_name = 'quality_controls_per_shift'
  ) THEN
    ALTER TABLE public.bc_operational_data
      ALTER COLUMN quality_controls_per_shift TYPE numeric(6,2)
      USING quality_controls_per_shift::numeric;
  END IF;
END $$;
