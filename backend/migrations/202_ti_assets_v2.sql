-- Migration: 202_ti_assets_v2.sql
-- Module: Activos TI V2 — schema completo (tablas, índices, columnas, trigger)
-- Idempotente: usa IF NOT EXISTS y ADD COLUMN IF NOT EXISTS en todas partes.

-- ─── ti_assets ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ti_assets (
  id                          BIGSERIAL PRIMARY KEY,
  asset_code                  TEXT UNIQUE,
  name                        TEXT NOT NULL,
  brand                       TEXT,
  model                       TEXT,
  characteristics             JSONB        NOT NULL DEFAULT '{}'::jsonb,
  status                      TEXT         NOT NULL DEFAULT 'unassigned',
  assigned_to_user_id         INTEGER      REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_at                 TIMESTAMPTZ,
  last_maintenance_at         DATE,
  maintenance_frequency_months INTEGER     NOT NULL DEFAULT 12,
  active                      BOOLEAN      NOT NULL DEFAULT true,
  created_by                  INTEGER      REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by                  INTEGER      REFERENCES public.users(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE public.ti_assets ADD COLUMN IF NOT EXISTS serial_number    TEXT;
ALTER TABLE public.ti_assets ADD COLUMN IF NOT EXISTS imei             TEXT;
ALTER TABLE public.ti_assets ADD COLUMN IF NOT EXISTS purchase_date    DATE;
ALTER TABLE public.ti_assets ADD COLUMN IF NOT EXISTS purchase_value   DECIMAL(12, 2);
ALTER TABLE public.ti_assets ADD COLUMN IF NOT EXISTS value_category   TEXT CHECK (value_category IN ('asset', 'control_item'));

CREATE INDEX IF NOT EXISTS idx_ti_assets_status         ON public.ti_assets(status);
CREATE INDEX IF NOT EXISTS idx_ti_assets_assigned_user  ON public.ti_assets(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_ti_assets_purchase_value ON public.ti_assets(purchase_value);
CREATE INDEX IF NOT EXISTS idx_ti_assets_value_category ON public.ti_assets(value_category);

-- ─── ti_asset_assignments ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ti_asset_assignments (
  id                  BIGSERIAL PRIMARY KEY,
  asset_id            BIGINT    NOT NULL REFERENCES public.ti_assets(id) ON DELETE CASCADE,
  assigned_to_user_id INTEGER   REFERENCES public.users(id) ON DELETE SET NULL,
  previous_user_id    INTEGER   REFERENCES public.users(id) ON DELETE SET NULL,
  action              TEXT      NOT NULL,
  reason              TEXT,
  created_by          INTEGER   REFERENCES public.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ti_asset_assignments ADD COLUMN IF NOT EXISTS characteristics TEXT;

CREATE INDEX IF NOT EXISTS idx_ti_asset_assignments_asset_user
  ON public.ti_asset_assignments(asset_id, assigned_to_user_id);

-- ─── ti_asset_events ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ti_asset_events (
  id          BIGSERIAL PRIMARY KEY,
  asset_id    BIGINT    NOT NULL REFERENCES public.ti_assets(id) ON DELETE CASCADE,
  event_type  TEXT      NOT NULL,
  payload     JSONB     NOT NULL DEFAULT '{}'::jsonb,
  created_by  INTEGER   REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ti_asset_events_asset_date
  ON public.ti_asset_events(asset_id, created_at DESC);

-- ─── ti_asset_maintenance_schedule ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ti_asset_maintenance_schedule (
  id                           BIGSERIAL PRIMARY KEY,
  asset_id                     BIGINT    NOT NULL REFERENCES public.ti_assets(id) ON DELETE CASCADE,
  year                         INTEGER   NOT NULL,
  planned_date                 DATE      NOT NULL,
  max_due_date                 DATE,
  coordinated_withdrawal_date  DATE,
  status                       TEXT      NOT NULL DEFAULT 'pending',
  completed_at                 TIMESTAMPTZ,
  notes                        TEXT,
  created_by                   INTEGER   REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by                   INTEGER   REFERENCES public.users(id) ON DELETE SET NULL,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(asset_id, planned_date)
);

ALTER TABLE public.ti_asset_maintenance_schedule ADD COLUMN IF NOT EXISTS max_due_date                DATE;
ALTER TABLE public.ti_asset_maintenance_schedule ADD COLUMN IF NOT EXISTS coordinated_withdrawal_date DATE;

CREATE INDEX IF NOT EXISTS idx_ti_asset_schedule_year
  ON public.ti_asset_maintenance_schedule(year, status);

-- ─── ti_asset_accessories ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ti_asset_accessories (
  id                 BIGSERIAL PRIMARY KEY,
  asset_id           BIGINT    NOT NULL REFERENCES public.ti_assets(id) ON DELETE CASCADE,
  name               TEXT      NOT NULL,
  brand              TEXT,
  model              TEXT,
  serial_number      TEXT,
  imei               TEXT,
  is_new             BOOLEAN   NOT NULL DEFAULT false,
  physical_condition INTEGER,
  observations       TEXT,
  active             BOOLEAN   NOT NULL DEFAULT true,
  created_by         INTEGER   REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by         INTEGER   REFERENCES public.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ti_asset_accessories ADD COLUMN IF NOT EXISTS numero_corporativo TEXT;

CREATE INDEX IF NOT EXISTS idx_ti_accessories_asset
  ON public.ti_asset_accessories(asset_id, active);

-- ─── ti_asset_actas ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ti_asset_actas (
  id                  BIGSERIAL PRIMARY KEY,
  acta_code           TEXT UNIQUE NOT NULL,
  tipo                TEXT        NOT NULL,
  asset_id            BIGINT      REFERENCES public.ti_assets(id) ON DELETE SET NULL,
  recipient_user_id   INTEGER     REFERENCES public.users(id) ON DELETE SET NULL,
  previous_user_id    INTEGER     REFERENCES public.users(id) ON DELETE SET NULL,
  recipient_nombre    TEXT,
  recipient_cedula    TEXT,
  recipient_cargo     TEXT,
  acta_day            INTEGER,
  acta_month          INTEGER,
  acta_year           INTEGER,
  generated_by        INTEGER     REFERENCES public.users(id) ON DELETE SET NULL,
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes               TEXT,
  pdf_filename        TEXT,
  pdf_sha256          TEXT,
  pdf_drive_url       TEXT,
  pdf_drive_file_id   TEXT,
  active              BOOLEAN     NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Columnas añadidas en versiones posteriores
ALTER TABLE public.ti_asset_actas ALTER COLUMN asset_id DROP NOT NULL;
ALTER TABLE public.ti_asset_actas ADD COLUMN IF NOT EXISTS acta_code             TEXT UNIQUE;
ALTER TABLE public.ti_asset_actas ADD COLUMN IF NOT EXISTS acta_day              INTEGER;
ALTER TABLE public.ti_asset_actas ADD COLUMN IF NOT EXISTS acta_month            INTEGER;
ALTER TABLE public.ti_asset_actas ADD COLUMN IF NOT EXISTS acta_year             INTEGER;
ALTER TABLE public.ti_asset_actas ADD COLUMN IF NOT EXISTS signed_pdf_drive_file_id TEXT;
ALTER TABLE public.ti_asset_actas ADD COLUMN IF NOT EXISTS signed_pdf_drive_url     TEXT;
ALTER TABLE public.ti_asset_actas ADD COLUMN IF NOT EXISTS signed_pdf_sha256        TEXT;
ALTER TABLE public.ti_asset_actas ADD COLUMN IF NOT EXISTS signed_pdf_filename      TEXT;
ALTER TABLE public.ti_asset_actas ADD COLUMN IF NOT EXISTS signed_at               TIMESTAMPTZ;
ALTER TABLE public.ti_asset_actas ADD COLUMN IF NOT EXISTS signed_by               INTEGER REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.ti_asset_actas ADD COLUMN IF NOT EXISTS is_complete             BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_ti_actas_asset     ON public.ti_asset_actas(asset_id);
CREATE INDEX IF NOT EXISTS idx_ti_actas_generated ON public.ti_asset_actas(generated_at DESC);

-- ─── ti_asset_actas_items ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ti_asset_actas_items (
  id                  BIGSERIAL PRIMARY KEY,
  acta_id             BIGINT    NOT NULL REFERENCES public.ti_asset_actas(id) ON DELETE CASCADE,
  order_num           INTEGER   NOT NULL,
  item_type           TEXT      NOT NULL,
  asset_id            BIGINT    REFERENCES public.ti_assets(id) ON DELETE SET NULL,
  accessory_id        BIGINT    REFERENCES public.ti_asset_accessories(id) ON DELETE SET NULL,
  name                TEXT      NOT NULL,
  brand_model         TEXT,
  serial_imei         TEXT,
  is_new              BOOLEAN,
  physical_condition  INTEGER,
  observations        TEXT
);

ALTER TABLE public.ti_asset_actas_items ADD COLUMN IF NOT EXISTS characteristics TEXT;

CREATE INDEX IF NOT EXISTS idx_ti_actas_items_acta ON public.ti_asset_actas_items(acta_id);

-- ─── ti_asset_financial_docs ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ti_asset_financial_docs (
  id               BIGSERIAL PRIMARY KEY,
  asset_id         BIGINT    NOT NULL REFERENCES public.ti_assets(id) ON DELETE CASCADE,
  doc_type         TEXT      NOT NULL,
  assigned_user_id INTEGER   REFERENCES public.users(id) ON DELETE SET NULL,
  filename         TEXT,
  drive_file_id    TEXT,
  drive_url        TEXT,
  sha256           TEXT,
  notes            TEXT,
  uploaded_by      INTEGER   REFERENCES public.users(id) ON DELETE SET NULL,
  uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  active           BOOLEAN   NOT NULL DEFAULT true
);

-- Columnas añadidas en versiones posteriores
ALTER TABLE public.ti_asset_financial_docs ADD COLUMN IF NOT EXISTS assigned_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.ti_asset_financial_docs ADD COLUMN IF NOT EXISTS assignment_id    BIGINT  REFERENCES public.ti_asset_assignments(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ti_financial_docs_asset_type_factura
  ON public.ti_asset_financial_docs(asset_id, doc_type)
  WHERE active = true AND doc_type = 'factura';

CREATE INDEX IF NOT EXISTS idx_ti_asset_financial_docs_user       ON public.ti_asset_financial_docs(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_ti_asset_financial_docs_assignment ON public.ti_asset_financial_docs(assignment_id);

-- ─── ti_asset_liberation_photos ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ti_asset_liberation_photos (
  id            BIGSERIAL PRIMARY KEY,
  asset_id      BIGINT    NOT NULL REFERENCES public.ti_assets(id) ON DELETE CASCADE,
  filename      TEXT      NOT NULL,
  drive_url     TEXT,
  drive_file_id TEXT,
  sha256        TEXT,
  liberated_by  INTEGER   REFERENCES public.users(id) ON DELETE SET NULL,
  liberated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes         TEXT,
  active        BOOLEAN   NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ti_asset_liberation_photos_asset
  ON public.ti_asset_liberation_photos(asset_id);
CREATE INDEX IF NOT EXISTS idx_ti_asset_liberation_photos_liberated_at
  ON public.ti_asset_liberation_photos(liberated_at DESC);

-- ─── ti_corporate_numbers ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ti_corporate_numbers (
  id                  BIGSERIAL PRIMARY KEY,
  number              TEXT      NOT NULL UNIQUE,
  status              TEXT      NOT NULL DEFAULT 'available'
                        CHECK (status IN ('available', 'assigned', 'inactive')),
  asset_id            BIGINT    REFERENCES public.ti_assets(id) ON DELETE SET NULL,
  assigned_to_user_id INTEGER   REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ti_corporate_numbers_status ON public.ti_corporate_numbers(status);
CREATE INDEX IF NOT EXISTS idx_ti_corporate_numbers_asset  ON public.ti_corporate_numbers(asset_id);
CREATE INDEX IF NOT EXISTS idx_ti_corporate_numbers_user   ON public.ti_corporate_numbers(assigned_to_user_id);

-- ─── ti_corporate_number_history ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ti_corporate_number_history (
  id         BIGSERIAL PRIMARY KEY,
  number_id  BIGINT    NOT NULL REFERENCES public.ti_corporate_numbers(id) ON DELETE CASCADE,
  old_number TEXT,
  new_number TEXT      NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by INTEGER   REFERENCES public.users(id) ON DELETE SET NULL,
  reason     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ti_corporate_number_history_number
  ON public.ti_corporate_number_history(number_id);
CREATE INDEX IF NOT EXISTS idx_ti_corporate_number_history_changed_at
  ON public.ti_corporate_number_history(changed_at DESC);

-- ─── Trigger: auditar cambios de status ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_ti_asset_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.ti_asset_events (asset_id, event_type, payload, created_by, created_at)
    VALUES (NEW.id, 'status_change', jsonb_build_object(
      'old_status', OLD.status,
      'new_status', NEW.status,
      'changed_at', now()
    ), NEW.updated_by, now());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_ti_asset_status_change'
      AND tgrelid = 'public.ti_assets'::regclass
  ) THEN
    CREATE TRIGGER trg_ti_asset_status_change
    AFTER UPDATE ON public.ti_assets
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_ti_asset_status_change();
  END IF;
END;
$$;
