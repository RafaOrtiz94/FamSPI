-- 130_workflow_alignment.sql
-- Alineación con WORKFLOW_PROPUESTA_ALINEADA_FINAL.md
-- Partes 1 y 2 del plan de producción.
--
-- Cambios:
--  1. supply_control_type en private_purchase_requests
--  2. serial_status en ambas tablas
--  3. participation_decision en equipment_purchase_requests (compra pública)
--  4. availability_status en equipment_purchase_requests
--  5. private_purchase_id FK en delivery_ceiling (soporte control insumos privado)

-- =========================================================
-- 1. supply_control_type en private_purchase_requests
-- =========================================================
-- Origen:
--   comodato         → bc_maximums
--   venta/alquiler/alquiler_transferencia_dominio con entregables → commercial_deliverables
--   sin entregables  → none
--   antes de derivar → pending

ALTER TABLE public.private_purchase_requests
  ADD COLUMN IF NOT EXISTS supply_control_type TEXT
    CHECK (supply_control_type IN ('bc_maximums', 'commercial_deliverables', 'none', 'pending'))
    DEFAULT 'pending';

UPDATE public.private_purchase_requests
  SET supply_control_type = CASE
    WHEN offer_kind = 'comodato' THEN 'bc_maximums'
    ELSE 'pending'
  END
  WHERE supply_control_type IS NULL OR supply_control_type = 'pending';

COMMENT ON COLUMN public.private_purchase_requests.supply_control_type IS
  'bc_maximums: máximos del BC (comodato); commercial_deliverables: entregables comerciales; none: sin control; pending: aún no derivado';

-- =========================================================
-- 2. serial_status en ambas tablas
-- =========================================================
-- Gate: serial solo registrable cuando serial_status = received_pending_serial.

ALTER TABLE public.equipment_purchase_requests
  ADD COLUMN IF NOT EXISTS serial_status TEXT
    CHECK (serial_status IN (
      'not_applicable_yet',
      'pending_reception',
      'received_pending_serial',
      'serial_registered'
    ))
    DEFAULT 'not_applicable_yet';

ALTER TABLE public.private_purchase_requests
  ADD COLUMN IF NOT EXISTS serial_status TEXT
    CHECK (serial_status IN (
      'not_applicable_yet',
      'pending_reception',
      'received_pending_serial',
      'serial_registered'
    ))
    DEFAULT 'not_applicable_yet';

-- Migrar registros existentes con equipo ya llegado en purchases públicas.
UPDATE public.equipment_purchase_requests
  SET serial_status = CASE
    WHEN status IN ('completed') THEN 'serial_registered'
    WHEN status IN ('waiting_dispatch', 'dispatch_ready') THEN 'received_pending_serial'
    WHEN equipment_arrived_at IS NOT NULL THEN 'received_pending_serial'
    WHEN status IN ('delivery_dates_submitted', 'delivery_dates_requested', 'contract_available') THEN 'pending_reception'
    ELSE 'not_applicable_yet'
  END
  WHERE serial_status = 'not_applicable_yet'
    AND COALESCE(request_type, 'purchase') = 'purchase';

COMMENT ON COLUMN public.equipment_purchase_requests.serial_status IS
  'Gate para registro de serial: solo se registra cuando = received_pending_serial (equipo recibido físicamente)';
COMMENT ON COLUMN public.private_purchase_requests.serial_status IS
  'Gate para registro de serial: solo se registra cuando = received_pending_serial (equipo recibido físicamente)';

-- =========================================================
-- 3. participation_decision en equipment_purchase_requests (solo compra pública)
-- =========================================================
-- Regla: decisión formal de participar ANTES de asignar ACP.
-- Valores: pending | participate | not_participate

ALTER TABLE public.equipment_purchase_requests
  ADD COLUMN IF NOT EXISTS participation_decision TEXT
    CHECK (participation_decision IN ('pending', 'participate', 'not_participate'))
    DEFAULT 'pending';

ALTER TABLE public.equipment_purchase_requests
  ADD COLUMN IF NOT EXISTS participation_decision_at TIMESTAMPTZ;

ALTER TABLE public.equipment_purchase_requests
  ADD COLUMN IF NOT EXISTS participation_decision_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.equipment_purchase_requests
  ADD COLUMN IF NOT EXISTS participation_decision_notes TEXT;

-- Registros existentes con ACP asignado ya tomaron la decisión implícitamente.
UPDATE public.equipment_purchase_requests
  SET participation_decision = 'participate'
  WHERE participation_decision = 'pending'
    AND assigned_to IS NOT NULL
    AND COALESCE(request_type, 'purchase') = 'purchase';

COMMENT ON COLUMN public.equipment_purchase_requests.participation_decision IS
  'Solo para compra pública. Decisión formal de participar antes de asignar ACP Comercial.';

-- =========================================================
-- 4. availability_status en equipment_purchase_requests
-- =========================================================
-- La tabla privada ya usa estados de SM (ACP_AVAILABILITY_*).
-- La tabla pública solo tenía availability_email_sent_at.

ALTER TABLE public.equipment_purchase_requests
  ADD COLUMN IF NOT EXISTS availability_status TEXT
    CHECK (availability_status IN (
      'not_checked',
      'internal_available_ready',
      'supplier_requested',
      'supplier_confirmed',
      'supplier_rejected',
      'alternative_required',
      'availability_confirmed'
    ))
    DEFAULT 'not_checked';

-- Migrar desde campo legacy availability_email_sent_at.
UPDATE public.equipment_purchase_requests
  SET availability_status = CASE
    WHEN status IN ('completed', 'waiting_dispatch', 'dispatch_ready',
                    'delivery_dates_submitted', 'delivery_dates_requested',
                    'contract_available', 'pending_contract',
                    'waiting_signed_proforma', 'proforma_received',
                    'waiting_proforma') THEN 'availability_confirmed'
    WHEN availability_email_sent_at IS NOT NULL THEN 'supplier_requested'
    ELSE 'not_checked'
  END
  WHERE availability_status = 'not_checked'
    AND COALESCE(request_type, 'purchase') = 'purchase';

COMMENT ON COLUMN public.equipment_purchase_requests.availability_status IS
  'Estado de disponibilidad del equipo. Fuente de verdad para el Tab 2 del workspace unificado.';

-- =========================================================
-- 5. private_purchase_id FK en delivery_ceiling
-- =========================================================
-- delivery_ceiling actualmente solo referencia equipment_purchase_requests via business_case_id.
-- Se agrega columna para asociar también a private_purchase_requests (comodato o comerciales).

ALTER TABLE public.delivery_ceiling
  ADD COLUMN IF NOT EXISTS private_purchase_id UUID REFERENCES public.private_purchase_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_delivery_ceiling_private_purchase_id
  ON public.delivery_ceiling (private_purchase_id)
  WHERE private_purchase_id IS NOT NULL;

COMMENT ON COLUMN public.delivery_ceiling.private_purchase_id IS
  'FK a private_purchase_requests para control de insumos en compras privadas (comodato = bc_maximums, otras = commercial_deliverables)';

-- =========================================================
-- Índices de soporte
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_epr_participation_decision
  ON public.equipment_purchase_requests (participation_decision)
  WHERE participation_decision IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_epr_availability_status
  ON public.equipment_purchase_requests (availability_status)
  WHERE availability_status != 'not_checked';

CREATE INDEX IF NOT EXISTS idx_epr_serial_status
  ON public.equipment_purchase_requests (serial_status)
  WHERE serial_status != 'not_applicable_yet';

CREATE INDEX IF NOT EXISTS idx_ppr_serial_status
  ON public.private_purchase_requests (serial_status)
  WHERE serial_status != 'not_applicable_yet';

CREATE INDEX IF NOT EXISTS idx_ppr_supply_control_type
  ON public.private_purchase_requests (supply_control_type)
  WHERE supply_control_type IS NOT NULL;

-- =========================================================
-- Registro de migración
-- =========================================================
INSERT INTO migration_audit_log (
  migration_name,
  phase,
  operation,
  table_name,
  rows_affected,
  details,
  success
) VALUES (
  '130_workflow_alignment',
  'schema_extension',
  'add_workflow_alignment_columns',
  'equipment_purchase_requests,private_purchase_requests,delivery_ceiling',
  0,
  'Alineación workflow: supply_control_type, serial_status, participation_decision, availability_status, delivery_ceiling.private_purchase_id',
  true
);
