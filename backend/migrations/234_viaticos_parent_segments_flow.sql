-- Migration 234: Modelo padre/hijos para viaticos
-- Objetivo:
-- 1. Consolidar travel_allowances como expediente padre
-- 2. Persistir subexpedientes por tipo de proceso (con tarjeta / sin tarjeta)
-- 3. Registrar trazabilidad formal de observaciones y transiciones
-- 4. Preparar vencimiento, anulacion y saldo global del expediente

ALTER TABLE public.travel_allowances
  ADD COLUMN IF NOT EXISTS processing_state VARCHAR(30) NOT NULL DEFAULT 'sin_procesar',
  ADD COLUMN IF NOT EXISTS processing_deadline_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS grace_deadline_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processed_month DATE,
  ADD COLUMN IF NOT EXISTS annulled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS annulled_reason TEXT,
  ADD COLUMN IF NOT EXISTS final_balance_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_balance_result VARCHAR(20) NOT NULL DEFAULT 'en_cero';

ALTER TABLE public.travel_allowances
  DROP CONSTRAINT IF EXISTS travel_allowances_processing_state_check;

ALTER TABLE public.travel_allowances
  ADD CONSTRAINT travel_allowances_processing_state_check
  CHECK (processing_state IN ('sin_procesar', 'parcial', 'liquidado_total', 'anulado'));

ALTER TABLE public.travel_allowances
  DROP CONSTRAINT IF EXISTS travel_allowances_final_balance_result_check;

ALTER TABLE public.travel_allowances
  ADD CONSTRAINT travel_allowances_final_balance_result_check
  CHECK (final_balance_result IN ('por_pagar', 'en_cero', 'por_devolver'));

CREATE INDEX IF NOT EXISTS idx_travel_allowances_processing_state
  ON public.travel_allowances(processing_state);

CREATE INDEX IF NOT EXISTS idx_travel_allowances_processed_month
  ON public.travel_allowances(processed_month)
  WHERE processed_month IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_travel_allowances_deadline
  ON public.travel_allowances(grace_deadline_at)
  WHERE grace_deadline_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.travel_allowance_segments (
  id BIGSERIAL PRIMARY KEY,
  allowance_id BIGINT NOT NULL REFERENCES public.travel_allowances(id) ON DELETE CASCADE,
  segment_type VARCHAR(20) NOT NULL,
  workflow_status VARCHAR(20) NOT NULL DEFAULT 'borrador',
  submitted_at TIMESTAMPTZ,
  submitted_by_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  review_started_at TIMESTAMPTZ,
  reviewed_by_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  approved_by_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  rejected_at TIMESTAMPTZ,
  rejected_by_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  liquidated_at TIMESTAMPTZ,
  liquidated_by_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  calculated_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  approved_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  economic_result_type VARCHAR(30),
  economic_result_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  bank_payment_reference TEXT,
  liquidation_document_drive_id TEXT,
  liquidation_document_drive_url TEXT,
  visible_in_active_queue BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_travel_allowance_segments_allowance_type UNIQUE (allowance_id, segment_type),
  CONSTRAINT travel_allowance_segments_segment_type_check
    CHECK (segment_type IN ('with_card', 'without_card')),
  CONSTRAINT travel_allowance_segments_workflow_status_check
    CHECK (workflow_status IN ('borrador', 'enviado', 'en_revision', 'aprobado', 'rechazado', 'liquidado')),
  CONSTRAINT travel_allowance_segments_economic_result_type_check
    CHECK (
      economic_result_type IS NULL
      OR economic_result_type IN ('valor_a_pagar', 'saldo_cero', 'valor_a_devolver')
    )
);

CREATE INDEX IF NOT EXISTS idx_travel_allowance_segments_queue
  ON public.travel_allowance_segments(segment_type, workflow_status, visible_in_active_queue);

CREATE INDEX IF NOT EXISTS idx_travel_allowance_segments_allowance
  ON public.travel_allowance_segments(allowance_id);

CREATE TABLE IF NOT EXISTS public.travel_allowance_segment_events (
  id BIGSERIAL PRIMARY KEY,
  allowance_id BIGINT NOT NULL REFERENCES public.travel_allowances(id) ON DELETE CASCADE,
  segment_id BIGINT REFERENCES public.travel_allowance_segments(id) ON DELETE CASCADE,
  event_type VARCHAR(40) NOT NULL,
  from_status VARCHAR(30),
  to_status VARCHAR(30),
  observation TEXT,
  actor_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_travel_allowance_segment_events_allowance
  ON public.travel_allowance_segment_events(allowance_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_travel_allowance_segment_events_segment
  ON public.travel_allowance_segment_events(segment_id, created_at DESC)
  WHERE segment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.viatico_anticipos (
  id SERIAL PRIMARY KEY,
  allowance_id INTEGER NOT NULL REFERENCES public.travel_allowances(id) ON DELETE CASCADE,
  requested_by_user_id INTEGER REFERENCES public.users(id),
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  purpose TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending_approval',
  approved_by_user_id INTEGER REFERENCES public.users(id),
  approved_at TIMESTAMPTZ,
  disbursed_at TIMESTAMPTZ,
  payment_reference VARCHAR(255),
  applied_at TIMESTAMPTZ,
  applied_amount NUMERIC(12,2),
  difference_amount NUMERIC(12,2),
  rejected_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.viatico_anticipos
  ADD COLUMN IF NOT EXISTS payment_receipt_drive_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_receipt_drive_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_receipt_uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_receipt_uploaded_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.travel_allowance_invoices
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS returned_to_draft_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS returned_to_draft_by_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.travel_allowance_purchases_no_invoice
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS returned_to_draft_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS returned_to_draft_by_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL;

UPDATE public.travel_allowances
   SET processing_state = CASE
         WHEN COALESCE(outside_labor_area, FALSE) = FALSE AND COALESCE(classification_completed, FALSE) = TRUE
           THEN 'sin_procesar'
         ELSE 'sin_procesar'
       END,
       final_balance_result = 'en_cero',
       final_balance_amount = COALESCE(final_balance_amount, 0),
       processed_month = COALESCE(processed_month, date_trunc('month', visit_date)::date)
 WHERE processing_state IS NULL
    OR processed_month IS NULL;
