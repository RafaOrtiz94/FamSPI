BEGIN;

CREATE TABLE IF NOT EXISTS public.equipment_asset_status_catalog (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  color_token TEXT NOT NULL,
  lifecycle_group TEXT NOT NULL,
  is_available_for_negotiation BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 100,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.equipment_asset_status_catalog
  (code, label, color_token, lifecycle_group, is_available_for_negotiation, sort_order, description)
VALUES
  ('in_storage', 'En almacenamiento', 'slate', 'stock', true, 10, 'Activo fisico disponible en bodega o inventario controlado.'),
  ('ready_100', 'Listo y al 100%', 'green', 'stock', true, 20, 'Activo verificado, completo y disponible para negociacion o instalacion.'),
  ('reserved', 'Reservado', 'blue', 'commercial', false, 30, 'Activo comprometido para una negociacion o entrega especifica.'),
  ('in_transit', 'En transito', 'blue', 'logistics', false, 40, 'Activo en traslado hacia cliente, bodega o servicio.'),
  ('installed_client', 'En cliente', 'green', 'installed', false, 50, 'Activo instalado y asignado a cliente/sucursal.'),
  ('waiting_parts', 'Esperando repuesto', 'amber', 'service', false, 60, 'Activo detenido por falta de repuesto, pieza o material.'),
  ('under_maintenance', 'En mantenimiento', 'amber', 'service', false, 70, 'Activo intervenido por mantenimiento preventivo o correctivo.'),
  ('with_issues', 'Con problemas', 'red', 'service', false, 80, 'Activo con falla o condicion que requiere gestion tecnica.'),
  ('pending_recycling', 'Para reciclaje', 'red', 'retirement', false, 90, 'Activo marcado para reciclaje, baja o disposicion.'),
  ('retired', 'Retirado', 'slate', 'retirement', false, 100, 'Activo retirado de cliente o de operacion.'),
  ('decommissioned', 'Dado de baja', 'slate', 'retirement', false, 110, 'Activo fuera de uso operacional.')
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  color_token = EXCLUDED.color_token,
  lifecycle_group = EXCLUDED.lifecycle_group,
  is_available_for_negotiation = EXCLUDED.is_available_for_negotiation,
  sort_order = EXCLUDED.sort_order,
  description = EXCLUDED.description,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.part_catalog (
  id BIGSERIAL PRIMARY KEY,
  code TEXT,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'pieza',
  unit TEXT NOT NULL DEFAULT 'unidad',
  brand TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT part_catalog_category_check CHECK (category IN ('pieza', 'repuesto', 'material', 'consumible', 'reactivo', 'calibrador', 'control'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_part_catalog_code_lower
  ON public.part_catalog (LOWER(code))
  WHERE code IS NOT NULL AND btrim(code) <> '';

CREATE TABLE IF NOT EXISTS public.maintenance_procedures (
  id BIGSERIAL PRIMARY KEY,
  equipment_model_id BIGINT NOT NULL REFERENCES public.equipment_models(id) ON DELETE CASCADE,
  procedure_code TEXT,
  name TEXT NOT NULL,
  maintenance_type TEXT NOT NULL DEFAULT 'preventivo',
  interval_months INTEGER,
  estimated_hours NUMERIC(8,2),
  instructions TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT maintenance_procedures_type_check CHECK (maintenance_type IN ('preventivo', 'correctivo', 'instalacion', 'calibracion', 'verificacion'))
);

CREATE INDEX IF NOT EXISTS idx_maintenance_procedures_model
  ON public.maintenance_procedures (equipment_model_id, maintenance_type, is_active);

CREATE TABLE IF NOT EXISTS public.maintenance_procedure_parts (
  id BIGSERIAL PRIMARY KEY,
  procedure_id BIGINT NOT NULL REFERENCES public.maintenance_procedures(id) ON DELETE CASCADE,
  part_id BIGINT NOT NULL REFERENCES public.part_catalog(id) ON DELETE RESTRICT,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (procedure_id, part_id)
);

CREATE TABLE IF NOT EXISTS public.maintenance_procedure_materials (
  id BIGSERIAL PRIMARY KEY,
  procedure_id BIGINT NOT NULL REFERENCES public.maintenance_procedures(id) ON DELETE CASCADE,
  material_name TEXT NOT NULL,
  material_type TEXT NOT NULL DEFAULT 'material',
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'unidad',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.equipment_assets (
  id BIGSERIAL PRIMARY KEY,
  equipment_model_id BIGINT NOT NULL REFERENCES public.equipment_models(id) ON DELETE RESTRICT,
  serial_number TEXT,
  internal_code TEXT,
  asset_tag TEXT,
  current_status TEXT NOT NULL REFERENCES public.equipment_asset_status_catalog(code),
  client_id BIGINT,
  client_location_id BIGINT,
  current_location TEXT,
  negotiated_by_module TEXT,
  negotiation_reference_id BIGINT,
  installed_at TIMESTAMPTZ,
  warranty_until DATE,
  notes TEXT,
  created_by BIGINT,
  updated_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_equipment_assets_serial_lower
  ON public.equipment_assets (LOWER(serial_number))
  WHERE serial_number IS NOT NULL AND btrim(serial_number) <> '';

CREATE INDEX IF NOT EXISTS idx_equipment_assets_model_status
  ON public.equipment_assets (equipment_model_id, current_status);

CREATE INDEX IF NOT EXISTS idx_equipment_assets_client
  ON public.equipment_assets (client_id, client_location_id);

CREATE TABLE IF NOT EXISTS public.equipment_asset_events (
  id BIGSERIAL PRIMARY KEY,
  asset_id BIGINT NOT NULL REFERENCES public.equipment_assets(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  from_status TEXT REFERENCES public.equipment_asset_status_catalog(code),
  to_status TEXT REFERENCES public.equipment_asset_status_catalog(code),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equipment_asset_events_asset
  ON public.equipment_asset_events (asset_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.equipment_asset_reservations (
  id BIGSERIAL PRIMARY KEY,
  asset_id BIGINT NOT NULL REFERENCES public.equipment_assets(id) ON DELETE CASCADE,
  source_module TEXT NOT NULL,
  source_reference_id BIGINT,
  reserved_for_client_id BIGINT,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ,
  notes TEXT,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT equipment_asset_reservations_status_check CHECK (status IN ('active', 'released', 'converted', 'expired', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_equipment_asset_reservations_asset
  ON public.equipment_asset_reservations (asset_id, status);

CREATE TABLE IF NOT EXISTS public.equipment_asset_maintenance_schedule (
  id BIGSERIAL PRIMARY KEY,
  asset_id BIGINT NOT NULL REFERENCES public.equipment_assets(id) ON DELETE CASCADE,
  procedure_id BIGINT NOT NULL REFERENCES public.maintenance_procedures(id) ON DELETE RESTRICT,
  scheduled_for DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  source_event_id BIGINT REFERENCES public.equipment_asset_events(id) ON DELETE SET NULL,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT equipment_asset_schedule_status_check CHECK (status IN ('scheduled', 'due', 'in_progress', 'done', 'skipped', 'cancelled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_equipment_asset_schedule_asset_procedure_date
  ON public.equipment_asset_maintenance_schedule (asset_id, procedure_id, scheduled_for);

CREATE INDEX IF NOT EXISTS idx_equipment_asset_schedule_due
  ON public.equipment_asset_maintenance_schedule (scheduled_for, status);

COMMIT;
