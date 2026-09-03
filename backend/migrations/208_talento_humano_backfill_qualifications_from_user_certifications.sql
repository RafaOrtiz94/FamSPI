-- Migration: 208_talento_humano_backfill_qualifications_from_user_certifications.sql
-- Objetivo:
-- 1. Copiar registros legacy desde user_certifications a collaborator_qualifications
-- 2. No asumir clasificacion academica cuando no exista evidencia suficiente
-- 3. Mantener user_certifications intacta mientras se completa la transicion
--
-- Regla de precision:
-- - certification, course, diploma y other migran a qualification_type = 'certification'
-- - title solo migra cuando metadata evidencia explicitamente 3er o 4to nivel
-- - title sin evidencia suficiente NO se migra automaticamente

BEGIN;

WITH normalized_source AS (
  SELECT
    uc.id AS legacy_id,
    uc.user_id,
    uc.title,
    uc.issuer,
    uc.issue_date,
    uc.expiry_date,
    uc.credential_type,
    uc.description,
    uc.drive_file_id,
    uc.file_url,
    uc.metadata,
    uc.is_active,
    uc.created_at,
    uc.updated_at,
    LOWER(TRIM(COALESCE(uc.credential_type, ''))) AS credential_type_normalized,
    LOWER(TRIM(COALESCE(uc.metadata->>'qualification_type', ''))) AS metadata_qualification_type,
    LOWER(TRIM(COALESCE(uc.metadata->>'nivel_titulo', ''))) AS metadata_title_level,
    LOWER(TRIM(COALESCE(uc.metadata->>'education_level', ''))) AS metadata_education_level,
    LOWER(TRIM(COALESCE(uc.metadata->>'degree_level', ''))) AS metadata_degree_level
  FROM user_certifications uc
),
resolved_source AS (
  SELECT
    source.*,
    CASE
      WHEN source.metadata_qualification_type IN (
        'third_level_title',
        'fourth_level_title',
        'certification',
        'senescyt_record'
      ) THEN source.metadata_qualification_type
      WHEN source.credential_type_normalized IN ('certification', 'course', 'diploma', 'other') THEN 'certification'
      WHEN source.credential_type_normalized = 'title'
        AND (
          source.metadata_title_level LIKE '%3%'
          OR source.metadata_title_level LIKE '%tercer%'
          OR source.metadata_education_level LIKE '%3%'
          OR source.metadata_education_level LIKE '%tercer%'
          OR source.metadata_degree_level LIKE '%3%'
          OR source.metadata_degree_level LIKE '%tercer%'
        ) THEN 'third_level_title'
      WHEN source.credential_type_normalized = 'title'
        AND (
          source.metadata_title_level LIKE '%4%'
          OR source.metadata_title_level LIKE '%cuarto%'
          OR source.metadata_education_level LIKE '%4%'
          OR source.metadata_education_level LIKE '%cuarto%'
          OR source.metadata_degree_level LIKE '%4%'
          OR source.metadata_degree_level LIKE '%cuarto%'
        ) THEN 'fourth_level_title'
      ELSE NULL
    END AS resolved_qualification_type
  FROM normalized_source source
)
INSERT INTO collaborator_qualifications (
  user_id,
  qualification_type,
  title,
  institution,
  issuer,
  issue_date,
  expiry_date,
  registration_number,
  metadata,
  drive_file_id,
  drive_url,
  file_name,
  mime_type,
  uploaded_by,
  is_active,
  created_at,
  updated_at
)
SELECT
  source.user_id,
  source.resolved_qualification_type,
  source.title,
  NULLIF(TRIM(COALESCE(source.metadata->>'institution', source.metadata->>'entity', source.issuer, '')), ''),
  source.issuer,
  source.issue_date,
  source.expiry_date,
  NULLIF(
    TRIM(
      COALESCE(
        source.metadata->>'registration_number',
        source.metadata->>'credential_id',
        source.metadata->>'credentialId',
        source.metadata->>'folio',
        ''
      )
    ),
    ''
  ),
  jsonb_set(
    COALESCE(source.metadata, '{}'::jsonb),
    '{legacy}',
    jsonb_build_object(
      'source_table', 'user_certifications',
      'legacy_id', source.legacy_id,
      'legacy_credential_type', source.credential_type,
      'migration_code', '208_talento_humano_backfill_qualifications_from_user_certifications'
    ),
    true
  ),
  source.drive_file_id,
  source.file_url,
  NULL,
  NULL,
  source.user_id,
  source.is_active,
  source.created_at,
  source.updated_at
FROM resolved_source source
WHERE source.resolved_qualification_type IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM collaborator_qualifications target
    WHERE target.user_id = source.user_id
      AND target.qualification_type = source.resolved_qualification_type
      AND target.title = source.title
      AND COALESCE(target.issue_date::text, '') = COALESCE(source.issue_date::text, '')
      AND COALESCE(target.drive_file_id, '') = COALESCE(source.drive_file_id, '')
      AND COALESCE(target.metadata->'legacy'->>'legacy_id', '') = source.legacy_id::text
  );

COMMIT;
