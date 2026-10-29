-- ================================================
-- Migración 172: Campos para checklist portal público y control operativo
-- Fecha: 2026-05-12
-- ================================================

-- 1. Campos para checklist del portal público (solo compra pública)
ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS public_portal_checklist JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS public_portal_evidence_url TEXT,
ADD COLUMN IF NOT EXISTS public_portal_due_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS public_portal_responsible_id UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS equipment_ready_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS status_unified TEXT;

-- 2. Campos para control operativo de máximos/entregables
ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS max_quantity NUMERIC,
ADD COLUMN IF NOT EXISTS requested_quantity NUMERIC,
ADD COLUMN IF NOT EXISTS delivered_quantity NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS remaining_quantity NUMERIC,
ADD COLUMN IF NOT EXISTS supply_control_deliverables JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS control_operativo_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS control_operativo_completed_at TIMESTAMPTZ;

-- 3. Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_eqp_purchase_requests_status_unified ON equipment_purchase_requests(status_unified);
CREATE INDEX IF NOT EXISTS idx_eqp_purchase_requests_public_portal_responsible ON equipment_purchase_requests(public_portal_responsible_id);

-- ================================================
-- Fin de migración 172
-- ================================================
