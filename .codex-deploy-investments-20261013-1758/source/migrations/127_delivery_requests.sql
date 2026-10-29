-- 127_delivery_requests.sql
-- REQ-SPI-005, REQ-SPI-007 (SPI), REQ-SPI-011
-- Delivery request entities and transactional support for delivered quantities.

ALTER TABLE public.delivery_ceiling_line
  ADD COLUMN IF NOT EXISTS delivered_qty NUMERIC(14,3) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_ceiling_line_delivered_qty_non_negative_check'
  ) THEN
    ALTER TABLE public.delivery_ceiling_line
      ADD CONSTRAINT delivery_ceiling_line_delivered_qty_non_negative_check
      CHECK (delivered_qty >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_ceiling_line_delivered_not_exceed_max_check'
  ) THEN
    ALTER TABLE public.delivery_ceiling_line
      ADD CONSTRAINT delivery_ceiling_line_delivered_not_exceed_max_check
      CHECK (delivered_qty <= max_quantity);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.delivery_request (
  id BIGSERIAL PRIMARY KEY,
  delivery_ceiling_id BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_by INTEGER NULL,
  confirmed_by INTEGER NULL,
  notes TEXT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.delivery_request
  ADD COLUMN IF NOT EXISTS delivery_ceiling_id BIGINT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS requested_by INTEGER NULL,
  ADD COLUMN IF NOT EXISTS confirmed_by INTEGER NULL,
  ADD COLUMN IF NOT EXISTS notes TEXT NULL,
  ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_request_delivery_ceiling_fk'
  ) THEN
    ALTER TABLE public.delivery_request
      ADD CONSTRAINT delivery_request_delivery_ceiling_fk
      FOREIGN KEY (delivery_ceiling_id) REFERENCES public.delivery_ceiling(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_request_requested_by_fk'
  ) THEN
    ALTER TABLE public.delivery_request
      ADD CONSTRAINT delivery_request_requested_by_fk
      FOREIGN KEY (requested_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_request_confirmed_by_fk'
  ) THEN
    ALTER TABLE public.delivery_request
      ADD CONSTRAINT delivery_request_confirmed_by_fk
      FOREIGN KEY (confirmed_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_request_status_check'
  ) THEN
    ALTER TABLE public.delivery_request
      ADD CONSTRAINT delivery_request_status_check
      CHECK (status IN ('pending', 'confirmed', 'cancelled'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_request_confirmed_consistency_check'
  ) THEN
    ALTER TABLE public.delivery_request
      ADD CONSTRAINT delivery_request_confirmed_consistency_check
      CHECK (
        (status <> 'confirmed')
        OR (confirmed_at IS NOT NULL)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_delivery_request_ceiling_status
  ON public.delivery_request (delivery_ceiling_id, status, id DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_request_requested_at
  ON public.delivery_request (requested_at DESC);

CREATE TABLE IF NOT EXISTS public.delivery_request_line (
  id BIGSERIAL PRIMARY KEY,
  delivery_request_id BIGINT NOT NULL,
  delivery_ceiling_line_id BIGINT NOT NULL,
  requested_qty NUMERIC(14,3) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.delivery_request_line
  ADD COLUMN IF NOT EXISTS delivery_request_id BIGINT,
  ADD COLUMN IF NOT EXISTS delivery_ceiling_line_id BIGINT,
  ADD COLUMN IF NOT EXISTS requested_qty NUMERIC(14,3),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_request_line_request_fk'
  ) THEN
    ALTER TABLE public.delivery_request_line
      ADD CONSTRAINT delivery_request_line_request_fk
      FOREIGN KEY (delivery_request_id) REFERENCES public.delivery_request(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_request_line_ceiling_line_fk'
  ) THEN
    ALTER TABLE public.delivery_request_line
      ADD CONSTRAINT delivery_request_line_ceiling_line_fk
      FOREIGN KEY (delivery_ceiling_line_id) REFERENCES public.delivery_ceiling_line(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_request_line_requested_qty_positive_check'
  ) THEN
    ALTER TABLE public.delivery_request_line
      ADD CONSTRAINT delivery_request_line_requested_qty_positive_check
      CHECK (requested_qty > 0);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_delivery_request_line_unique_item
  ON public.delivery_request_line (delivery_request_id, delivery_ceiling_line_id);

CREATE INDEX IF NOT EXISTS idx_delivery_request_line_ceiling_line
  ON public.delivery_request_line (delivery_ceiling_line_id, delivery_request_id);

COMMENT ON TABLE public.delivery_request IS
  'Solicitudes de entrega parcial creadas en SPI sobre un delivery_ceiling activo.';

COMMENT ON TABLE public.delivery_request_line IS
  'Lineas solicitadas por item para cada delivery_request.';

