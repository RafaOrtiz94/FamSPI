-- Migration: 206_talento_humano_expediente_centralization_phase1.sql
-- Objetivo:
-- 1. Crear estructura central para credenciales del expediente HR
-- 2. Extender collaborator_documents con clasificación fuerte
-- 3. Preparar el dominio de Talento Humano para ser la única fuente de verdad
--
-- Importante:
-- - No elimina tablas existentes
-- - No mueve datos todavía
-- - No modifica lógica de aplicación
-- - Es una migración no destructiva de Phase 1

BEGIN;

-- ---------------------------------------------------------------------------
-- Phase 1A. Tabla central para títulos, certificaciones y registros múltiples
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS collaborator_qualifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  qualification_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  institution VARCHAR(255),
  issuer VARCHAR(255),
  issue_date DATE,
  expiry_date DATE,
  registration_number VARCHAR(255),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  drive_file_id TEXT,
  drive_url TEXT,
  file_name TEXT,
  mime_type TEXT,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT collaborator_qualifications_type_check CHECK (
    qualification_type IN (
      'third_level_title',
      'fourth_level_title',
      'certification',
      'senescyt_record'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_collaborator_qualifications_user_id
  ON collaborator_qualifications(user_id);

CREATE INDEX IF NOT EXISTS idx_collaborator_qualifications_type
  ON collaborator_qualifications(qualification_type);

CREATE INDEX IF NOT EXISTS idx_collaborator_qualifications_active
  ON collaborator_qualifications(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_collaborator_qualifications_created_at
  ON collaborator_qualifications(created_at DESC);

COMMENT ON TABLE collaborator_qualifications IS
  'Fuente central de verdad HR para titulos, certificaciones y registros SENESCYT del colaborador';

COMMENT ON COLUMN collaborator_qualifications.qualification_type IS
  'Clasificacion canonica del expediente HR: third_level_title, fourth_level_title, certification, senescyt_record';

-- ---------------------------------------------------------------------------
-- Phase 1B. Extensión de collaborator_documents con clasificación funcional
-- ---------------------------------------------------------------------------

ALTER TABLE collaborator_documents
  ADD COLUMN IF NOT EXISTS category VARCHAR(50);

ALTER TABLE collaborator_documents
  ADD COLUMN IF NOT EXISTS subtype VARCHAR(100);

ALTER TABLE collaborator_documents
  ADD COLUMN IF NOT EXISTS owner_area VARCHAR(50);

ALTER TABLE collaborator_documents
  ADD COLUMN IF NOT EXISTS source_channel VARCHAR(50);

ALTER TABLE collaborator_documents
  ADD COLUMN IF NOT EXISTS visibility_scope VARCHAR(50);

ALTER TABLE collaborator_documents
  ADD COLUMN IF NOT EXISTS group_key VARCHAR(100);

ALTER TABLE collaborator_documents
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE collaborator_documents
  ADD COLUMN IF NOT EXISTS is_required BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE collaborator_documents
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'collaborator_documents_category_check'
  ) THEN
    ALTER TABLE collaborator_documents
      ADD CONSTRAINT collaborator_documents_category_check
      CHECK (
        category IS NULL OR category IN (
          'identity',
          'family',
          'education',
          'qualification',
          'employment',
          'onboarding',
          'finance',
          'offboarding',
          'asset_delivery'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'collaborator_documents_owner_area_check'
  ) THEN
    ALTER TABLE collaborator_documents
      ADD CONSTRAINT collaborator_documents_owner_area_check
      CHECK (
        owner_area IS NULL OR owner_area IN (
          'perfil',
          'talento_humano',
          'financiero',
          'automatico'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'collaborator_documents_source_channel_check'
  ) THEN
    ALTER TABLE collaborator_documents
      ADD CONSTRAINT collaborator_documents_source_channel_check
      CHECK (
        source_channel IS NULL OR source_channel IN (
          'perfil',
          'workspace_th',
          'workspace_financiero',
          'integracion',
          'migracion'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'collaborator_documents_visibility_scope_check'
  ) THEN
    ALTER TABLE collaborator_documents
      ADD CONSTRAINT collaborator_documents_visibility_scope_check
      CHECK (
        visibility_scope IS NULL OR visibility_scope IN (
          'colaborador',
          'talento_humano',
          'financiero',
          'interno'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_collaborator_documents_owner_area
  ON collaborator_documents(owner_area);

CREATE INDEX IF NOT EXISTS idx_collaborator_documents_category
  ON collaborator_documents(category);

CREATE INDEX IF NOT EXISTS idx_collaborator_documents_group_key
  ON collaborator_documents(group_key);

CREATE INDEX IF NOT EXISTS idx_collaborator_documents_source_channel
  ON collaborator_documents(source_channel);

CREATE INDEX IF NOT EXISTS idx_collaborator_documents_is_active
  ON collaborator_documents(user_id, is_active);

COMMENT ON COLUMN collaborator_documents.owner_area IS
  'Area duena del documento dentro del expediente HR: perfil, talento_humano, financiero, automatico';

COMMENT ON COLUMN collaborator_documents.source_channel IS
  'Canal que realizo la carga o insercion del documento';

COMMENT ON COLUMN collaborator_documents.group_key IS
  'Permite agrupar documentos en modales funcionales como contrato o induccion';

-- ---------------------------------------------------------------------------
-- Phase 1C. Índice defensivo para evitar duplicidades activas exactas
-- Nota: no se crea como UNIQUE aún para no bloquear datos heredados no auditados.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_collaborator_documents_user_doc_active_lookup
  ON collaborator_documents(user_id, doc_type, is_active, created_at DESC);

COMMIT;
