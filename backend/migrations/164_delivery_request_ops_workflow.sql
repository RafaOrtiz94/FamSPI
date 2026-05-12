-- 164_delivery_request_ops_workflow.sql
-- Extiende el flujo de delivery_request con un paso intermedio de Operaciones.
--
-- Flujo anterior:  pending  →  confirmed  |  cancelled
-- Flujo nuevo:     pending  →  ops_approved  →  confirmed  |  cancelled
--
-- Roles por etapa:
--   pending       → creado por Comercial / ACP Comercial
--   ops_approved  → aprobado por Jefe Operaciones / Operaciones (ordena el producto)
--   confirmed     → despachado por Jefe Logistica (registra el envio)
--   cancelled     → cancelado en cualquier etapa
--
-- OPEN_REQUEST_STATUSES ahora es ['pending', 'ops_approved']:
--   ambos estados reservan saldo hasta que logistica confirme el despacho.
--
-- Nota: Las solicitudes existentes en estado 'pending' requieren pasar por
-- ops_approve antes de poder ser confirmadas por logistica.

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1: Agregar columnas de trazabilidad de operaciones
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.delivery_request
  ADD COLUMN IF NOT EXISTS ops_approved_by  INTEGER     NULL,
  ADD COLUMN IF NOT EXISTS ops_approved_at  TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.delivery_request.ops_approved_by IS
  'Usuario de Operaciones que aprobó la solicitud y ordenó el producto.';

COMMENT ON COLUMN public.delivery_request.ops_approved_at IS
  'Timestamp en que Operaciones aprobó la solicitud.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 2: Índice para consultas por ceiling_id + status (panel de operaciones
--         y logística filtra por status frecuentemente)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_delivery_request_ceiling_status
  ON public.delivery_request (delivery_ceiling_id, status);
