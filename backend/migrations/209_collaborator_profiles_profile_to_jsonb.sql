-- Migration: 209_collaborator_profiles_profile_to_jsonb.sql
-- Cambia collaborator_profiles.profile de TEXT a JSONB.
-- Esto permite usar operadores -> y ->> directamente sin cast manual.
-- REQUISITO: todos los registros existentes deben tener JSON válido.
-- Si algún registro tiene JSON inválido, este script falla en la línea ALTER COLUMN.

BEGIN;

-- Sanity check: muestra registros con JSON inválido antes de migrar.
-- Si esta query retorna filas, corrígelas primero antes de aplicar la migración.
DO $$
DECLARE
  bad_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad_count
  FROM public.collaborator_profiles
  WHERE profile IS NOT NULL
    AND profile::text != ''
    AND profile::text != 'null'
    AND (
      -- intenta parsear; si falla, cuenta como inválido
      CASE WHEN profile::text ~ '^\s*[\{\[]' THEN false ELSE true END
    );

  IF bad_count > 0 THEN
    RAISE EXCEPTION 'Hay % registro(s) con JSON potencialmente inválido en collaborator_profiles.profile. Revísalos antes de migrar.', bad_count;
  END IF;
END $$;

-- Nulifica registros vacíos o 'null' para evitar error de cast
UPDATE public.collaborator_profiles
  SET profile = NULL
  WHERE profile IS NOT NULL
    AND TRIM(profile::text) IN ('', 'null');

-- Cambia el tipo de TEXT a JSONB
ALTER TABLE public.collaborator_profiles
  ALTER COLUMN profile TYPE jsonb
  USING CASE
    WHEN profile IS NULL OR TRIM(profile::text) = '' THEN NULL
    ELSE profile::jsonb
  END;

-- Asegura que el default también sea jsonb
ALTER TABLE public.collaborator_profiles
  ALTER COLUMN profile SET DEFAULT '{}'::jsonb;

COMMIT;
