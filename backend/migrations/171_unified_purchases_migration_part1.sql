-- ================================================
-- MIGRACIÓN 171: Unificación de purchases — Parte 1
--
-- Objetivo: Agregar campos esenciales del flujo completo de private-purchases
-- a equipment-purchases para fusionar ambos módulos.
--
-- Campos agregados:
-- - forwarded_to_acp_at
-- - business_case_id
-- - offer_document_id
-- - offer_signed_document_id
-- - comodato_document_id
-- - contract_document_id
-- - contract_signed_document_id
-- - contract_client_signed_document_id
-- - delivery_act_document_id
-- - site_inspection_report_document_id
-- - inspection_acta_document_id
-- - manager_contract_decision
-- - manager_contract_decision_reason
-- - manager_contract_decision_at
-- - manager_contract_decision_by
-- - offer_valid_until
-- - offer_kind
-- - offer_signed_uploaded_at
-- - backoffice_approved_at
-- - commercial_accepted_offer_at
-- - signed_offer_received_at
-- - client_registered_at
-- - client_registration_requested_at
-- - client_approved_at
-- - operations_notes
-- - estimated_arrival_at
-- - estimated_arrival_updated_at
-- - dispatch_items_json
-- - dispatch_notes
-- - delivery_guides_json
-- - delivery_guides_uploaded_at
-- - delivery_act_number
-- - delivery_act_dispatched_by
-- - delivery_act_dispatched_at
-- - delivery_act_delivered_by
-- - delivery_act_delivered_at
-- - delivery_act_observations_json
-- - delivery_act_draft_document_id
-- - delivery_act_draft_generated_at
-- - delivery_act_generated_at
-- - delivery_act_assigned_to_user_id
-- - delivery_act_assigned_to_email
-- - delivery_act_assigned_to_name
-- - delivery_act_assigned_at
-- - delivery_act_assigned_by
-- - delivery_act_logistics_signed_document_id
-- - delivery_act_logistics_signed_at
-- - delivery_act_logistics_signed_by
-- - site_inspection
-- - site_inspection_status
-- - site_inspection_result
-- - site_inspection_follow_up_date
-- - site_inspection_report_link
-- - site_inspection_report_generated_at
-- - site_inspection_ready_for_installation
-- - site_inspection_requires_reinspection
-- - site_inspection_updated_at
-- - site_inspection_updated_by
-- - site_inspection_updated_by_email
-- - comodato_business_case_id
-- - equipment_purchase_request_id
-- - client_request_id
-- - client_snapshot
-- - client_type
--
-- Fecha: 2026-05-12
-- ================================================

BEGIN;

-- 1. Agregar campos esenciales del flujo de private-purchases
ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS forwarded_to_acp_at TIMESTAMPTZ;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS business_case_id UUID;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS offer_document_id VARCHAR(255);

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS offer_signed_document_id VARCHAR(255);

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS comodato_document_id VARCHAR(255);

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS contract_document_id VARCHAR(255);

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS contract_signed_document_id VARCHAR(255);

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS contract_client_signed_document_id VARCHAR(255);

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS delivery_act_document_id VARCHAR(255);

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS site_inspection_report_document_id VARCHAR(255);

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS inspection_acta_document_id VARCHAR(255);

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS manager_contract_decision VARCHAR(100);

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS manager_contract_decision_reason TEXT;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS manager_contract_decision_at TIMESTAMPTZ;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS manager_contract_decision_by INTEGER;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS offer_valid_until TIMESTAMPTZ;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS offer_kind VARCHAR(50);

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS offer_signed_uploaded_at TIMESTAMPTZ;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS backoffice_approved_at TIMESTAMPTZ;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS commercial_accepted_offer_at TIMESTAMPTZ;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS signed_offer_received_at TIMESTAMPTZ;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS client_registered_at TIMESTAMPTZ;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS client_registration_requested_at TIMESTAMPTZ;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS client_approved_at TIMESTAMPTZ;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS operations_notes TEXT;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS estimated_arrival_at TIMESTAMPTZ;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS estimated_arrival_updated_at TIMESTAMPTZ;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS dispatch_items_json JSONB;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS dispatch_notes TEXT;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS delivery_guides_json JSONB;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS delivery_guides_uploaded_at TIMESTAMPTZ;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS delivery_act_number VARCHAR(255);

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS delivery_act_dispatched_by VARCHAR(255);

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS delivery_act_dispatched_at TIMESTAMPTZ;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS delivery_act_delivered_by VARCHAR(255);

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS delivery_act_delivered_at TIMESTAMPTZ;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS delivery_act_observations_json JSONB;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS delivery_act_draft_document_id VARCHAR(255);

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS delivery_act_draft_generated_at TIMESTAMPTZ;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS delivery_act_generated_at TIMESTAMPTZ;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS delivery_act_assigned_to_user_id INTEGER;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS delivery_act_assigned_to_email VARCHAR(255);

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS delivery_act_assigned_to_name VARCHAR(255);

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS delivery_act_assigned_at TIMESTAMPTZ;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS delivery_act_assigned_by INTEGER;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS delivery_act_logistics_signed_document_id VARCHAR(255);

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS delivery_act_logistics_signed_at TIMESTAMPTZ;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS delivery_act_logistics_signed_by VARCHAR(255);

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS site_inspection JSONB;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS site_inspection_status VARCHAR(100);

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS site_inspection_result VARCHAR(100);

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS site_inspection_follow_up_date DATE;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS site_inspection_report_link TEXT;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS site_inspection_report_generated_at TIMESTAMPTZ;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS site_inspection_ready_for_installation BOOLEAN;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS site_inspection_requires_reinspection BOOLEAN;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS site_inspection_updated_at TIMESTAMPTZ;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS site_inspection_updated_by INTEGER;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS site_inspection_updated_by_email VARCHAR(255);

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS comodato_business_case_id UUID;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS equipment_purchase_request_id UUID;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS client_request_id INTEGER;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS client_snapshot JSONB;

ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS client_type VARCHAR(100);

-- 2. Crear enum de estados completo (copiado de private_purchase_requests)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'equipment_purchase_status'
    ) THEN
        CREATE TYPE equipment_purchase_status AS ENUM (
            'pending_commercial',
            'pending_backoffice',
            'offer_sent',
            'pending_manager_signature',
            'pending_client_signature',
            'offer_signed',
            'offer_rejected_by_commercial',
            'price_improvement_requested',
            'client_registration_requested',
            'client_registered',
            'inspection_requested',
            'sent_to_acp',
            'acp_availability_requested',
            'acp_availability_confirmed',
            'acp_availability_rejected',
            'pending_contract_client_signature',
            'pending_contract_approval',
            'contract_available',
            'contract_rejected',
            'delivery_dates_requested',
            'delivery_dates_submitted',
            'calendar_events_created',
            'waiting_dispatch',
            'dispatch_ready',
            'delivery_act_draft_ready',
            'delivery_act_tech_assigned',
            'delivery_act_logistics_signed',
            'delivery_act_generated',
            'delivered_signed',
            'rejected',
            'business_case_in_progress',
            'business_case_under_review',
            'business_case_feasibility_approved',
            'business_case_rejected',
            'pending_provider',
            'waiting_provider',
            'waiting_proforma',
            'proforma_received',
            'proforma_signed',
            'contract_signed',
            'waiting_inspection',
            'inspection_scheduled',
            'inspection_completed',
            'waiting_delivery',
            'delivery_scheduled',
            'equipment_arrived',
            'serial_registered',
            'ready_for_installation',
            'installation_in_progress',
            'installation_completed',
            'waiting_training',
            'training_scheduled',
            'training_completed',
            'completed',
            'cancelled'
        );
    END IF;
END
$$;

-- 3. Agregar columna status_unified para usar el nuevo enum
ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS status_unified equipment_purchase_status;

-- 4. Copiar valores de status a status_unified (conversión)
UPDATE equipment_purchase_requests
SET status_unified = CASE status
    WHEN 'pending_provider' THEN 'pending_provider'::equipment_purchase_status
    WHEN 'waiting_provider' THEN 'waiting_provider'::equipment_purchase_status
    WHEN 'waiting_proforma' THEN 'waiting_proforma'::equipment_purchase_status
    WHEN 'proforma_received' THEN 'proforma_received'::equipment_purchase_status
    WHEN 'proforma_signed' THEN 'proforma_signed'::equipment_purchase_status
    WHEN 'contract_signed' THEN 'contract_signed'::equipment_purchase_status
    WHEN 'waiting_inspection' THEN 'waiting_inspection'::equipment_purchase_status
    WHEN 'inspection_scheduled' THEN 'inspection_scheduled'::equipment_purchase_status
    WHEN 'inspection_completed' THEN 'inspection_completed'::equipment_purchase_status
    WHEN 'waiting_delivery' THEN 'waiting_delivery'::equipment_purchase_status
    WHEN 'delivery_scheduled' THEN 'delivery_scheduled'::equipment_purchase_status
    WHEN 'equipment_arrived' THEN 'equipment_arrived'::equipment_purchase_status
    WHEN 'serial_registered' THEN 'serial_registered'::equipment_purchase_status
    WHEN 'ready_for_installation' THEN 'ready_for_installation'::equipment_purchase_status
    WHEN 'installation_in_progress' THEN 'installation_in_progress'::equipment_purchase_status
    WHEN 'installation_completed' THEN 'installation_completed'::equipment_purchase_status
    WHEN 'waiting_training' THEN 'waiting_training'::equipment_purchase_status
    WHEN 'training_scheduled' THEN 'training_scheduled'::equipment_purchase_status
    WHEN 'training_completed' THEN 'training_completed'::equipment_purchase_status
    WHEN 'completed' THEN 'delivered_signed'::equipment_purchase_status
    WHEN 'cancelled' THEN 'rejected'::equipment_purchase_status
    ELSE 'pending_commercial'::equipment_purchase_status
END
WHERE status_unified IS NULL;

-- 5. Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_equipment_purchase_forwarded_to_acp ON equipment_purchase_requests(forwarded_to_acp_at);
CREATE INDEX IF NOT EXISTS idx_equipment_purchase_business_case ON equipment_purchase_requests(business_case_id);
CREATE INDEX IF NOT EXISTS idx_equipment_purchase_status_unified ON equipment_purchase_requests(status_unified);

COMMIT;

-- ================================================
-- MIGRACIÓN COMPLETA
-- ================================================
