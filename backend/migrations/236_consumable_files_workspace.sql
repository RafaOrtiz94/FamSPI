CREATE TABLE IF NOT EXISTS public.consumable_files (
  id UUID PRIMARY KEY,
  origin_type TEXT NOT NULL CHECK (origin_type IN ('standalone', 'purchase_linked')),
  purchase_type TEXT NULL CHECK (purchase_type IN ('public', 'private')),
  equipment_purchase_request_id UUID NULL REFERENCES public.equipment_purchase_requests(id) ON DELETE SET NULL,
  private_purchase_request_id UUID NULL REFERENCES public.private_purchase_requests(id) ON DELETE SET NULL,
  business_case_id UUID NULL,
  client_id INTEGER NULL REFERENCES public.clients(id) ON DELETE SET NULL,
  process_name TEXT NOT NULL,
  process_code TEXT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'registered', 'cancelled')),
  registered_at TIMESTAMPTZ NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by INTEGER NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT consumable_files_purchase_link_consistency_chk CHECK (
    (
      purchase_type IS NULL
      AND equipment_purchase_request_id IS NULL
      AND private_purchase_request_id IS NULL
    )
    OR (
      purchase_type = 'public'
      AND equipment_purchase_request_id IS NOT NULL
      AND private_purchase_request_id IS NULL
    )
    OR (
      purchase_type = 'private'
      AND private_purchase_request_id IS NOT NULL
      AND equipment_purchase_request_id IS NULL
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_consumable_files_public_purchase
  ON public.consumable_files (equipment_purchase_request_id)
  WHERE equipment_purchase_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_consumable_files_private_purchase
  ON public.consumable_files (private_purchase_request_id)
  WHERE private_purchase_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_consumable_files_business_case_id
  ON public.consumable_files (business_case_id)
  WHERE business_case_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_consumable_files_status
  ON public.consumable_files (status);

CREATE TABLE IF NOT EXISTS public.consumable_file_sections (
  id BIGSERIAL PRIMARY KEY,
  consumable_file_id UUID NOT NULL REFERENCES public.consumable_files(id) ON DELETE CASCADE,
  area_code TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (consumable_file_id, area_code)
);

CREATE INDEX IF NOT EXISTS idx_consumable_file_sections_file_id
  ON public.consumable_file_sections (consumable_file_id, sort_order, id);

CREATE TABLE IF NOT EXISTS public.consumable_file_lines (
  id BIGSERIAL PRIMARY KEY,
  consumable_file_section_id BIGINT NOT NULL REFERENCES public.consumable_file_sections(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  item_name TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('reactivo', 'control', 'calibrador', 'consumible', 'material', 'otro')),
  source_type TEXT NOT NULL DEFAULT 'catalog' CHECK (source_type IN ('catalog', 'equipment', 'manual', 'business_case')),
  catalog_consumable_id INTEGER NULL REFERENCES public.catalog_consumables(id) ON DELETE SET NULL,
  equipment_id INTEGER NULL,
  presentation_unit TEXT NOT NULL DEFAULT 'unidad',
  units_per_box NUMERIC(14,3) NOT NULL CHECK (units_per_box > 0),
  box_qty NUMERIC(14,3) NOT NULL CHECK (box_qty > 0),
  max_units NUMERIC(14,3) NOT NULL CHECK (max_units > 0),
  unit_price NUMERIC(14,4) NULL,
  business_case_item_key TEXT NULL,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by INTEGER NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (consumable_file_section_id, item_key)
);

CREATE INDEX IF NOT EXISTS idx_consumable_file_lines_section_id
  ON public.consumable_file_lines (consumable_file_section_id, item_type, item_name);

CREATE INDEX IF NOT EXISTS idx_consumable_file_lines_catalog
  ON public.consumable_file_lines (catalog_consumable_id)
  WHERE catalog_consumable_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.consumable_orders (
  id BIGSERIAL PRIMARY KEY,
  consumable_file_id UUID NOT NULL REFERENCES public.consumable_files(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'submitted', 'extra_pending', 'approved', 'partially_dispatched', 'dispatched', 'cancelled')),
  notes TEXT NULL,
  dispatch_notes TEXT NULL,
  submitted_at TIMESTAMPTZ NULL,
  approved_at TIMESTAMPTZ NULL,
  approved_by INTEGER NULL REFERENCES public.users(id),
  requested_by INTEGER NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consumable_orders_file_id
  ON public.consumable_orders (consumable_file_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_consumable_orders_status
  ON public.consumable_orders (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.consumable_order_lines (
  id BIGSERIAL PRIMARY KEY,
  consumable_order_id BIGINT NOT NULL REFERENCES public.consumable_orders(id) ON DELETE CASCADE,
  consumable_file_line_id BIGINT NOT NULL REFERENCES public.consumable_file_lines(id) ON DELETE RESTRICT,
  carryover_units NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (carryover_units >= 0),
  requested_new_units NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (requested_new_units >= 0),
  requested_units NUMERIC(14,3) NOT NULL CHECK (requested_units >= 0),
  available_before_request NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (available_before_request >= 0),
  base_requested_units NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (base_requested_units >= 0),
  extra_requested_units NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (extra_requested_units >= 0),
  approved_extra_units NUMERIC(14,3) NULL CHECK (approved_extra_units >= 0),
  extra_status TEXT NULL CHECK (extra_status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consumable_order_lines_order_id
  ON public.consumable_order_lines (consumable_order_id, id);

CREATE INDEX IF NOT EXISTS idx_consumable_order_lines_file_line_id
  ON public.consumable_order_lines (consumable_file_line_id);

CREATE TABLE IF NOT EXISTS public.consumable_dispatch_lines (
  id BIGSERIAL PRIMARY KEY,
  consumable_order_id BIGINT NOT NULL REFERENCES public.consumable_orders(id) ON DELETE CASCADE,
  consumable_order_line_id BIGINT NOT NULL REFERENCES public.consumable_order_lines(id) ON DELETE CASCADE,
  sent_units NUMERIC(14,3) NOT NULL CHECK (sent_units >= 0),
  pending_units NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (pending_units >= 0),
  notes TEXT NULL,
  dispatched_by INTEGER NULL REFERENCES public.users(id),
  dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  carried_forward_order_id BIGINT NULL REFERENCES public.consumable_orders(id) ON DELETE SET NULL,
  carried_forward_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consumable_dispatch_lines_order_line_id
  ON public.consumable_dispatch_lines (consumable_order_line_id, dispatched_at DESC);

CREATE INDEX IF NOT EXISTS idx_consumable_dispatch_lines_pending
  ON public.consumable_dispatch_lines (consumable_order_id, carried_forward_order_id)
  WHERE pending_units > 0;
