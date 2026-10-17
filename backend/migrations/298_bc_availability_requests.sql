-- Solicitud de disponibilidad de equipo a nivel Business Case (antes de factibilidad).
-- Comercial solicita; acp_comercial consulta a N proveedores y cierra con resultado consolidado.

CREATE TABLE IF NOT EXISTS public.bc_availability_requests (
  id                  BIGSERIAL PRIMARY KEY,
  business_case_id    UUID NOT NULL REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE,
  servicio_equipo_id  TEXT NOT NULL,
  equipment_name      TEXT,
  notes               TEXT,
  status              TEXT NOT NULL DEFAULT 'requested'
                      CHECK (status IN ('requested','in_progress','confirmed','rejected','cu_pending','import_pending')),
  result_notes        TEXT,
  requested_by        INTEGER NOT NULL,
  closed_by           INTEGER,
  request_id          INTEGER,            -- sin uso (reservado); no se genera ninguna solicitud F.ST
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bc_avail_req_bc ON public.bc_availability_requests (business_case_id);
CREATE INDEX IF NOT EXISTS idx_bc_avail_req_status ON public.bc_availability_requests (status);

CREATE TABLE IF NOT EXISTS public.bc_availability_supplier_queries (
  id                BIGSERIAL PRIMARY KEY,
  availability_id   BIGINT NOT NULL REFERENCES public.bc_availability_requests(id) ON DELETE CASCADE,
  provider_email    TEXT NOT NULL,
  email_thread_id   TEXT,
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  response_result   TEXT CHECK (response_result IN ('available_new','available_cu','import_only','unavailable')),
  response_notes    TEXT,
  responded_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bc_avail_q_req ON public.bc_availability_supplier_queries (availability_id);
