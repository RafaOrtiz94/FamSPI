-- 128_public_delivery_plan.sql
-- REQ-SPI-006 + extension REQ-SPI-011
-- Plan de entregas para compras publicas sobre delivery_ceiling.

CREATE TABLE IF NOT EXISTS public.public_delivery_plan (
  id BIGSERIAL PRIMARY KEY,
  delivery_ceiling_id BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT NULL,
  created_by INTEGER NULL,
  updated_by INTEGER NULL,
  approved_by INTEGER NULL,
  approved_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.public_delivery_plan
  ADD COLUMN IF NOT EXISTS delivery_ceiling_id BIGINT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS notes TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_by INTEGER NULL,
  ADD COLUMN IF NOT EXISTS updated_by INTEGER NULL,
  ADD COLUMN IF NOT EXISTS approved_by INTEGER NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'public_delivery_plan_delivery_ceiling_fk'
  ) THEN
    ALTER TABLE public.public_delivery_plan
      ADD CONSTRAINT public_delivery_plan_delivery_ceiling_fk
      FOREIGN KEY (delivery_ceiling_id) REFERENCES public.delivery_ceiling(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'public_delivery_plan_created_by_fk'
  ) THEN
    ALTER TABLE public.public_delivery_plan
      ADD CONSTRAINT public_delivery_plan_created_by_fk
      FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'public_delivery_plan_updated_by_fk'
  ) THEN
    ALTER TABLE public.public_delivery_plan
      ADD CONSTRAINT public_delivery_plan_updated_by_fk
      FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'public_delivery_plan_approved_by_fk'
  ) THEN
    ALTER TABLE public.public_delivery_plan
      ADD CONSTRAINT public_delivery_plan_approved_by_fk
      FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'public_delivery_plan_status_check'
  ) THEN
    ALTER TABLE public.public_delivery_plan
      ADD CONSTRAINT public_delivery_plan_status_check
      CHECK (status IN ('draft', 'approved', 'cancelled'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'public_delivery_plan_approval_consistency_check'
  ) THEN
    ALTER TABLE public.public_delivery_plan
      ADD CONSTRAINT public_delivery_plan_approval_consistency_check
      CHECK (
        (status <> 'approved')
        OR (approved_at IS NOT NULL)
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_public_delivery_plan_one_approved_per_ceiling
  ON public.public_delivery_plan (delivery_ceiling_id)
  WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS idx_public_delivery_plan_ceiling_status
  ON public.public_delivery_plan (delivery_ceiling_id, status, id DESC);

CREATE TABLE IF NOT EXISTS public.public_delivery_plan_line (
  id BIGSERIAL PRIMARY KEY,
  public_delivery_plan_id BIGINT NOT NULL,
  delivery_ceiling_line_id BIGINT NOT NULL,
  scheduled_start DATE NOT NULL,
  scheduled_end DATE NOT NULL,
  max_qty_tranche NUMERIC(14,3) NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.public_delivery_plan_line
  ADD COLUMN IF NOT EXISTS public_delivery_plan_id BIGINT,
  ADD COLUMN IF NOT EXISTS delivery_ceiling_line_id BIGINT,
  ADD COLUMN IF NOT EXISTS scheduled_start DATE,
  ADD COLUMN IF NOT EXISTS scheduled_end DATE,
  ADD COLUMN IF NOT EXISTS max_qty_tranche NUMERIC(14,3),
  ADD COLUMN IF NOT EXISTS notes TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'public_delivery_plan_line_plan_fk'
  ) THEN
    ALTER TABLE public.public_delivery_plan_line
      ADD CONSTRAINT public_delivery_plan_line_plan_fk
      FOREIGN KEY (public_delivery_plan_id) REFERENCES public.public_delivery_plan(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'public_delivery_plan_line_ceiling_line_fk'
  ) THEN
    ALTER TABLE public.public_delivery_plan_line
      ADD CONSTRAINT public_delivery_plan_line_ceiling_line_fk
      FOREIGN KEY (delivery_ceiling_line_id) REFERENCES public.delivery_ceiling_line(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'public_delivery_plan_line_date_range_check'
  ) THEN
    ALTER TABLE public.public_delivery_plan_line
      ADD CONSTRAINT public_delivery_plan_line_date_range_check
      CHECK (scheduled_end >= scheduled_start);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'public_delivery_plan_line_max_qty_positive_check'
  ) THEN
    ALTER TABLE public.public_delivery_plan_line
      ADD CONSTRAINT public_delivery_plan_line_max_qty_positive_check
      CHECK (max_qty_tranche > 0);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_public_delivery_plan_line_unique_tranche
  ON public.public_delivery_plan_line (
    public_delivery_plan_id,
    delivery_ceiling_line_id,
    scheduled_start,
    scheduled_end
  );

CREATE INDEX IF NOT EXISTS idx_public_delivery_plan_line_lookup
  ON public.public_delivery_plan_line (
    delivery_ceiling_line_id,
    scheduled_start,
    scheduled_end
  );

COMMENT ON TABLE public.public_delivery_plan IS
  'Plan de entregas para compras publicas, asociado a delivery_ceiling.';

COMMENT ON TABLE public.public_delivery_plan_line IS
  'Tramos de plan por linea de maximo para validaciones de delivery_request.';

