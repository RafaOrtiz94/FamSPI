-- 162_cutover_delivery_planning_columns.sql
-- CHG-08: delivery_ceiling / public_delivery_plan as single source of truth.
--
-- What this migration does:
--   1. Advance any records stuck in the now-removed planning stages.
--   2. Drop the five planning columns (scheduling data now lives in
--      public_delivery_plan_line). Trazabilidad columns are kept.
--
-- Removed routes (hard switch):
--   POST /equipment-purchases/:id/request-delivery-dates
--   POST /equipment-purchases/:id/submit-delivery-dates
--
-- Columns DROPPED (planning, replaced by public_delivery_plan_line):
--   delivery_dates_requested_at, delivery_dates_requested_by,
--   delivery_dates_requested_by_email, delivery_start_at, delivery_end_at
--
-- Columns KEPT (trazabilidad, still written by remaining routes):
--   delivery_notes, equipment_arrived_at/by/by_email,
--   dispatch_ready_at/by/by_email, delivered_at/by/by_email,
--   delivery_confirmed_notes

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1: Advance stuck planning-stage records
-- ─────────────────────────────────────────────────────────────────────────────

-- Records that had submitted dates can proceed to waiting_dispatch (physical
-- step follows from delivery_request.confirmed which now drives this stage).
UPDATE public.equipment_purchase_requests
   SET status    = 'waiting_dispatch',
       updated_at = NOW()
 WHERE status = 'delivery_dates_submitted';

-- Records that only requested dates (never submitted) revert to contract step
-- so they can re-enter the new flow via delivery_request.
UPDATE public.equipment_purchase_requests
   SET status    = 'contract_available',
       updated_at = NOW()
 WHERE status = 'delivery_dates_requested';

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 2: Drop planning columns
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.equipment_purchase_requests
  DROP COLUMN IF EXISTS delivery_dates_requested_at,
  DROP COLUMN IF EXISTS delivery_dates_requested_by,
  DROP COLUMN IF EXISTS delivery_dates_requested_by_email,
  DROP COLUMN IF EXISTS delivery_start_at,
  DROP COLUMN IF EXISTS delivery_end_at;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 3: Comment remaining trazabilidad columns
-- ─────────────────────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.equipment_purchase_requests.delivery_notes IS
  'Notas de trazabilidad logística (arribo, despacho). Solo escritura trazabilidad, no planificación.';

COMMENT ON COLUMN public.equipment_purchase_requests.equipment_arrived_at IS
  'Timestamp de arribo físico del equipo a bodega (trazabilidad).';

COMMENT ON COLUMN public.equipment_purchase_requests.dispatch_ready_at IS
  'Timestamp en que se marcó despacho listo (trazabilidad).';

COMMENT ON COLUMN public.equipment_purchase_requests.delivered_at IS
  'Timestamp de cierre de entrega completada (trazabilidad).';
