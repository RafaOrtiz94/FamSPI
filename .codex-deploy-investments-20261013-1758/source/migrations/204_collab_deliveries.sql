-- Migration: 204_collab_deliveries.sql
-- Module: Entregas Generales a Colaboradores
-- Cubre: catálogo de ítems, entregas, actas, eventos, renovaciones
-- Idempotente: usa IF NOT EXISTS y ADD COLUMN IF NOT EXISTS en todas partes.

-- ─── collab_item_catalog ─────────────────────────────────────────────────────
-- Catálogo de tipos de elementos entregables (no-TI).
-- requires_serial    → si el ítem debe tener número de serie registrado
-- requires_condition → si el ítem requiere valoración de condición física (1-10)
-- attribute_schema   → JSON con los campos libres sugeridos para esa categoría
CREATE TABLE IF NOT EXISTS public.collab_item_catalog (
  id                 BIGSERIAL PRIMARY KEY,
  category           TEXT      NOT NULL CHECK (category IN ('ropa','herramienta','logistica')),
  name               TEXT      NOT NULL,
  description        TEXT,
  requires_serial    BOOLEAN   NOT NULL DEFAULT false,
  requires_condition BOOLEAN   NOT NULL DEFAULT false,
  attribute_schema   JSONB     NOT NULL DEFAULT '{}'::jsonb,
  active             BOOLEAN   NOT NULL DEFAULT true,
  created_by         INTEGER   REFERENCES public.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collab_catalog_category
  ON public.collab_item_catalog(category) WHERE active = true;

-- Seeds base: tipos comunes por categoría
INSERT INTO public.collab_item_catalog (category, name, description, requires_serial, requires_condition, attribute_schema)
SELECT category, name, description, requires_serial, requires_condition, attribute_schema FROM (VALUES
  ('ropa'::text,        'Camiseta',                       'Camiseta corporativa',                false, false, '{"talla":"","color":"","cantidad":1}'::jsonb),
  ('ropa',              'Chompa',                         'Chompa corporativa',                  false, false, '{"talla":"","color":"","cantidad":1}'::jsonb),
  ('herramienta',       'Multímetro',                     'Medidor de voltaje/corriente',        true,  true,  '{"marca":"","modelo":""}'::jsonb),
  ('herramienta',       'Desarmadores (juego)',            'Juego de desarmadores varios',        false, true,  '{"marca":"","cantidad":1}'::jsonb),
  ('herramienta',       'Flexómetro',                     'Cinta métrica',                       false, true,  '{"marca":"","longitud_m":""}'::jsonb),
  ('herramienta',       'Llave ajustable',                'Llave inglesa ajustable',             false, true,  '{"marca":"","tamano_pulg":""}'::jsonb),
  ('herramienta',       'Maleta de herramientas',         'Maletín portaherramientas',           true,  true,  '{"marca":"","modelo":""}'::jsonb),
  ('logistica',         'Tarjeta de crédito empresarial', 'Tarjeta corporativa de la empresa',   false, false, '{"banco":"","numero_ultimos4":""}'::jsonb)
) AS v(category, name, description, requires_serial, requires_condition, attribute_schema)
WHERE NOT EXISTS (SELECT 1 FROM public.collab_item_catalog LIMIT 1);

-- ─── collab_deliveries ───────────────────────────────────────────────────────
-- Un registro por cada entrega activa o histórica de un ítem a un colaborador.
-- attributes → campos libres según categoría (talla, banco, etc.)
-- renewal_date / renewal_notes → criterio de renovación, seleccionable al registrar
CREATE TABLE IF NOT EXISTS public.collab_deliveries (
  id                 BIGSERIAL PRIMARY KEY,
  catalog_item_id    BIGINT    NOT NULL REFERENCES public.collab_item_catalog(id),
  user_id            INTEGER   NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  status             TEXT      NOT NULL DEFAULT 'entregado'
                       CHECK (status IN ('entregado','retirado','perdido','dañado')),
  serial_number      TEXT,
  physical_condition INTEGER   CHECK (physical_condition BETWEEN 1 AND 10),
  attributes         JSONB     NOT NULL DEFAULT '{}'::jsonb,
  observations       TEXT,
  delivery_date      DATE      NOT NULL,
  withdrawal_date    DATE,
  renewal_date       DATE,
  renewal_notes      TEXT,
  delivered_by       INTEGER   REFERENCES public.users(id) ON DELETE SET NULL,
  withdrawn_by       INTEGER   REFERENCES public.users(id) ON DELETE SET NULL,
  created_by         INTEGER   REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by         INTEGER   REFERENCES public.users(id) ON DELETE SET NULL,
  active             BOOLEAN   NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collab_deliveries_user
  ON public.collab_deliveries(user_id, status);
CREATE INDEX IF NOT EXISTS idx_collab_deliveries_catalog
  ON public.collab_deliveries(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_collab_deliveries_renewal
  ON public.collab_deliveries(renewal_date)
  WHERE renewal_date IS NOT NULL AND status = 'entregado';
CREATE INDEX IF NOT EXISTS idx_collab_deliveries_status
  ON public.collab_deliveries(status) WHERE active = true;

-- ─── collab_delivery_actas ───────────────────────────────────────────────────
-- Actas de entrega y retiro para categorías no-TI.
-- recipient_nombre/cedula/cargo → snapshot inmutable del momento del acta
-- pdf_sha256 / signed_pdf_sha256 → integridad del documento
CREATE TABLE IF NOT EXISTS public.collab_delivery_actas (
  id                       BIGSERIAL PRIMARY KEY,
  acta_code                TEXT      UNIQUE NOT NULL,
  tipo                     TEXT      NOT NULL CHECK (tipo IN ('entrega','retiro')),
  category                 TEXT      NOT NULL CHECK (category IN ('ropa','herramienta','logistica')),
  delivery_id              BIGINT    REFERENCES public.collab_deliveries(id) ON DELETE SET NULL,
  recipient_user_id        INTEGER   REFERENCES public.users(id) ON DELETE SET NULL,
  recipient_nombre         TEXT      NOT NULL,
  recipient_cedula         TEXT      NOT NULL,
  recipient_cargo          TEXT      NOT NULL,
  acta_day                 INTEGER   NOT NULL,
  acta_month               INTEGER   NOT NULL,
  acta_year                INTEGER   NOT NULL,
  generated_by             INTEGER   REFERENCES public.users(id) ON DELETE SET NULL,
  generated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes                    TEXT,
  pdf_filename             TEXT,
  pdf_sha256               TEXT,
  pdf_drive_url            TEXT,
  pdf_drive_file_id        TEXT,
  signed_pdf_sha256        TEXT,
  signed_pdf_drive_url     TEXT,
  signed_pdf_drive_file_id TEXT,
  signed_pdf_filename      TEXT,
  signed_at                TIMESTAMPTZ,
  signed_by                INTEGER   REFERENCES public.users(id) ON DELETE SET NULL,
  is_complete              BOOLEAN   NOT NULL DEFAULT false,
  active                   BOOLEAN   NOT NULL DEFAULT true,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collab_actas_delivery
  ON public.collab_delivery_actas(delivery_id);
CREATE INDEX IF NOT EXISTS idx_collab_actas_user
  ON public.collab_delivery_actas(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_collab_actas_generated
  ON public.collab_delivery_actas(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_collab_actas_pending_signature
  ON public.collab_delivery_actas(generated_at)
  WHERE is_complete = false AND active = true;

-- ─── collab_delivery_actas_items ─────────────────────────────────────────────
-- Líneas de detalle de cada acta (los ítems concretos listados en el documento)
CREATE TABLE IF NOT EXISTS public.collab_delivery_actas_items (
  id                 BIGSERIAL PRIMARY KEY,
  acta_id            BIGINT    NOT NULL REFERENCES public.collab_delivery_actas(id) ON DELETE CASCADE,
  order_num          INTEGER   NOT NULL,
  delivery_id        BIGINT    REFERENCES public.collab_deliveries(id) ON DELETE SET NULL,
  name               TEXT      NOT NULL,
  attributes_summary TEXT,
  serial_number      TEXT,
  is_new             BOOLEAN,
  physical_condition INTEGER,
  observations       TEXT
);

CREATE INDEX IF NOT EXISTS idx_collab_actas_items_acta
  ON public.collab_delivery_actas_items(acta_id);

-- ─── collab_delivery_events ──────────────────────────────────────────────────
-- Auditoría completa de todos los cambios sobre una entrega.
CREATE TABLE IF NOT EXISTS public.collab_delivery_events (
  id          BIGSERIAL PRIMARY KEY,
  delivery_id BIGINT    NOT NULL REFERENCES public.collab_deliveries(id) ON DELETE CASCADE,
  event_type  TEXT      NOT NULL,
  payload     JSONB     NOT NULL DEFAULT '{}'::jsonb,
  created_by  INTEGER   REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collab_events_delivery
  ON public.collab_delivery_events(delivery_id, created_at DESC);

-- ─── collab_renewal_schedule ─────────────────────────────────────────────────
-- Registro de renovaciones programadas por entrega.
-- Se crea automáticamente al registrar una entrega con renewal_date definido.
CREATE TABLE IF NOT EXISTS public.collab_renewal_schedule (
  id             BIGSERIAL PRIMARY KEY,
  delivery_id    BIGINT    NOT NULL REFERENCES public.collab_deliveries(id) ON DELETE CASCADE,
  scheduled_date DATE      NOT NULL,
  status         TEXT      NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','notified','completed','cancelled')),
  notes          TEXT,
  notified_at    TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  completed_by   INTEGER   REFERENCES public.users(id) ON DELETE SET NULL,
  created_by     INTEGER   REFERENCES public.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collab_renewal_pending
  ON public.collab_renewal_schedule(scheduled_date)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_collab_renewal_delivery
  ON public.collab_renewal_schedule(delivery_id);

-- ─── Secuencia para códigos de acta ──────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS collab_acta_seq START 1;
