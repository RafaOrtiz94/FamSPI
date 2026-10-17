-- 126_delivery_ceiling_tables.sql
-- REQ-SPI-002, REQ-SPI-003, REQ-SPI-031, REQ-SPI-040
-- Delivery ceilings per Business Case, item lines, and status audit trail.

CREATE TABLE IF NOT EXISTS public.delivery_ceiling (
  id BIGSERIAL PRIMARY KEY,
  business_case_id UUID NOT NULL,
  purchase_type TEXT NOT NULL DEFAULT 'private',
  status TEXT NOT NULL DEFAULT 'draft',
  valid_from DATE NOT NULL,
  valid_to DATE NULL,
  notes TEXT NULL,
  created_by INTEGER NULL,
  updated_by INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.delivery_ceiling
  ADD COLUMN IF NOT EXISTS business_case_id UUID,
  ADD COLUMN IF NOT EXISTS purchase_type TEXT NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS valid_from DATE,
  ADD COLUMN IF NOT EXISTS valid_to DATE NULL,
  ADD COLUMN IF NOT EXISTS notes TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_by INTEGER NULL,
  ADD COLUMN IF NOT EXISTS updated_by INTEGER NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_ceiling_business_case_fk'
  ) THEN
    ALTER TABLE public.delivery_ceiling
      ADD CONSTRAINT delivery_ceiling_business_case_fk
      FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_ceiling_created_by_fk'
  ) THEN
    ALTER TABLE public.delivery_ceiling
      ADD CONSTRAINT delivery_ceiling_created_by_fk
      FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_ceiling_updated_by_fk'
  ) THEN
    ALTER TABLE public.delivery_ceiling
      ADD CONSTRAINT delivery_ceiling_updated_by_fk
      FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_ceiling_purchase_type_check'
  ) THEN
    ALTER TABLE public.delivery_ceiling
      ADD CONSTRAINT delivery_ceiling_purchase_type_check
      CHECK (purchase_type IN ('private', 'public'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_ceiling_status_check'
  ) THEN
    ALTER TABLE public.delivery_ceiling
      ADD CONSTRAINT delivery_ceiling_status_check
      CHECK (status IN ('draft', 'approved', 'active', 'closed'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_ceiling_valid_range_check'
  ) THEN
    ALTER TABLE public.delivery_ceiling
      ADD CONSTRAINT delivery_ceiling_valid_range_check
      CHECK (valid_to IS NULL OR valid_to >= valid_from);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_delivery_ceiling_business_case
  ON public.delivery_ceiling (business_case_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_ceiling_status
  ON public.delivery_ceiling (status, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ux_delivery_ceiling_open_per_business_case
  ON public.delivery_ceiling (business_case_id)
  WHERE status IN ('draft', 'approved', 'active');

COMMENT ON TABLE public.delivery_ceiling IS
  'Cabecera de maximos por Business Case para controlar entregas parciales.';
COMMENT ON COLUMN public.delivery_ceiling.valid_to IS
  'Si es NULL, la vigencia se considera abierta hasta cierre explicito.';

CREATE TABLE IF NOT EXISTS public.delivery_ceiling_line (
  id BIGSERIAL PRIMARY KEY,
  delivery_ceiling_id BIGINT NOT NULL,
  max_quantity NUMERIC(14,3) NOT NULL,
  unit TEXT NOT NULL,
  item_type TEXT NOT NULL,
  equipment_model_id INTEGER NULL,
  integration_product_map_id BIGINT NULL,
  odoo_product_id INTEGER NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.delivery_ceiling_line
  ADD COLUMN IF NOT EXISTS delivery_ceiling_id BIGINT,
  ADD COLUMN IF NOT EXISTS max_quantity NUMERIC(14,3),
  ADD COLUMN IF NOT EXISTS unit TEXT,
  ADD COLUMN IF NOT EXISTS item_type TEXT,
  ADD COLUMN IF NOT EXISTS equipment_model_id INTEGER NULL,
  ADD COLUMN IF NOT EXISTS integration_product_map_id BIGINT NULL,
  ADD COLUMN IF NOT EXISTS odoo_product_id INTEGER NULL,
  ADD COLUMN IF NOT EXISTS notes TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_ceiling_line_delivery_ceiling_fk'
  ) THEN
    ALTER TABLE public.delivery_ceiling_line
      ADD CONSTRAINT delivery_ceiling_line_delivery_ceiling_fk
      FOREIGN KEY (delivery_ceiling_id) REFERENCES public.delivery_ceiling(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_ceiling_line_equipment_model_fk'
  ) THEN
    ALTER TABLE public.delivery_ceiling_line
      ADD CONSTRAINT delivery_ceiling_line_equipment_model_fk
      FOREIGN KEY (equipment_model_id) REFERENCES public.equipment_models(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'integration_product_map'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_ceiling_line_product_map_fk'
  ) THEN
    ALTER TABLE public.delivery_ceiling_line
      ADD CONSTRAINT delivery_ceiling_line_product_map_fk
      FOREIGN KEY (integration_product_map_id) REFERENCES public.integration_product_map(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_ceiling_line_max_quantity_check'
  ) THEN
    ALTER TABLE public.delivery_ceiling_line
      ADD CONSTRAINT delivery_ceiling_line_max_quantity_check
      CHECK (max_quantity > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_ceiling_line_item_type_check'
  ) THEN
    ALTER TABLE public.delivery_ceiling_line
      ADD CONSTRAINT delivery_ceiling_line_item_type_check
      CHECK (
        item_type IN (
          'equipment',
          'reagent',
          'determination',
          'calibrator',
          'control',
          'additional_investment',
          'service'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_ceiling_line_reference_check'
  ) THEN
    ALTER TABLE public.delivery_ceiling_line
      ADD CONSTRAINT delivery_ceiling_line_reference_check
      CHECK (
        equipment_model_id IS NOT NULL
        OR integration_product_map_id IS NOT NULL
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_ceiling_line_odoo_product_positive_check'
  ) THEN
    ALTER TABLE public.delivery_ceiling_line
      ADD CONSTRAINT delivery_ceiling_line_odoo_product_positive_check
      CHECK (odoo_product_id IS NULL OR odoo_product_id > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_delivery_ceiling_line_ceiling
  ON public.delivery_ceiling_line (delivery_ceiling_id, id DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_ceiling_line_item_type
  ON public.delivery_ceiling_line (item_type);

CREATE UNIQUE INDEX IF NOT EXISTS ux_delivery_ceiling_line_unique_reference
  ON public.delivery_ceiling_line (
    delivery_ceiling_id,
    item_type,
    COALESCE(equipment_model_id, 0),
    COALESCE(integration_product_map_id, 0),
    COALESCE(odoo_product_id, 0),
    LOWER(unit)
  );

COMMENT ON TABLE public.delivery_ceiling_line IS
  'Lineas de maximos por item para un delivery_ceiling.';

CREATE TABLE IF NOT EXISTS public.delivery_ceiling_audit (
  id BIGSERIAL PRIMARY KEY,
  delivery_ceiling_id BIGINT NOT NULL,
  business_case_id UUID NOT NULL,
  user_id INTEGER NULL,
  action TEXT NOT NULL,
  from_status TEXT NULL,
  to_status TEXT NULL,
  reason TEXT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.delivery_ceiling_audit
  ADD COLUMN IF NOT EXISTS delivery_ceiling_id BIGINT,
  ADD COLUMN IF NOT EXISTS business_case_id UUID,
  ADD COLUMN IF NOT EXISTS user_id INTEGER NULL,
  ADD COLUMN IF NOT EXISTS action TEXT,
  ADD COLUMN IF NOT EXISTS from_status TEXT NULL,
  ADD COLUMN IF NOT EXISTS to_status TEXT NULL,
  ADD COLUMN IF NOT EXISTS reason TEXT NULL,
  ADD COLUMN IF NOT EXISTS at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_ceiling_audit_delivery_ceiling_fk'
  ) THEN
    ALTER TABLE public.delivery_ceiling_audit
      ADD CONSTRAINT delivery_ceiling_audit_delivery_ceiling_fk
      FOREIGN KEY (delivery_ceiling_id) REFERENCES public.delivery_ceiling(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_ceiling_audit_business_case_fk'
  ) THEN
    ALTER TABLE public.delivery_ceiling_audit
      ADD CONSTRAINT delivery_ceiling_audit_business_case_fk
      FOREIGN KEY (business_case_id) REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_ceiling_audit_user_fk'
  ) THEN
    ALTER TABLE public.delivery_ceiling_audit
      ADD CONSTRAINT delivery_ceiling_audit_user_fk
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_ceiling_audit_action_check'
  ) THEN
    ALTER TABLE public.delivery_ceiling_audit
      ADD CONSTRAINT delivery_ceiling_audit_action_check
      CHECK (action IN ('create_draft', 'add_line', 'status_transition'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_ceiling_audit_status_values_check'
  ) THEN
    ALTER TABLE public.delivery_ceiling_audit
      ADD CONSTRAINT delivery_ceiling_audit_status_values_check
      CHECK (
        (from_status IS NULL OR from_status IN ('draft', 'approved', 'active', 'closed'))
        AND (to_status IS NULL OR to_status IN ('draft', 'approved', 'active', 'closed'))
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_delivery_ceiling_audit_ceiling
  ON public.delivery_ceiling_audit (delivery_ceiling_id, at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_ceiling_audit_business_case
  ON public.delivery_ceiling_audit (business_case_id, at DESC);

COMMENT ON TABLE public.delivery_ceiling_audit IS
  'Auditoria de cambios de estado y operaciones clave en delivery_ceiling.';
