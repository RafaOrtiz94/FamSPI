--
-- Migration 014: Private purchase request workflow
-- Integrates the new private client flow with the existing equipment purchase process
-- Uses the schema snapshot from actual111225.sql to extend tables without duplicating structures
--

CREATE TYPE public.private_purchase_status_enum AS ENUM (
    'pending_commercial',
    'pending_backoffice',
    'offer_sent',
    'offer_signed',
    'client_registered',
    'sent_to_acp',
    'rejected'
);

ALTER TYPE public.private_purchase_status_enum OWNER TO postgres;

CREATE TABLE public.private_purchase_requests (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_by integer,
    created_by_email character varying(255),
    client_request_id integer REFERENCES public.client_requests(id) ON DELETE SET NULL,
    client_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    client_type character varying(64) DEFAULT 'privado'::character varying,
    equipment jsonb NOT NULL DEFAULT '[]'::jsonb,
    status public.private_purchase_status_enum NOT NULL DEFAULT 'pending_commercial',
    offer_document_id character varying(255),
    offer_signed_document_id character varying(255),
    offer_signed_uploaded_at timestamp with time zone,
    backoffice_approved_at timestamp with time zone,
    commercial_accepted_offer_at timestamp with time zone,
    signed_offer_received_at timestamp with time zone,
    client_registered_at timestamp with time zone,
    forwarded_to_acp_at timestamp with time zone,
    equipment_purchase_request_id uuid REFERENCES public.equipment_purchase_requests(id),
    drive_folder_id character varying(255),
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.private_purchase_requests OWNER TO postgres;

CREATE INDEX private_purchase_requests_status_idx
    ON public.private_purchase_requests (status);

CREATE INDEX private_purchase_requests_created_by_idx
    ON public.private_purchase_requests (created_by);

COMMENT ON TABLE public.private_purchase_requests IS 'Solicitudes privadas de compra que recorren el flujo comercial → backoffice → ACP';

COMMENT ON COLUMN public.private_purchase_requests.client_snapshot IS 'Snapshot JSON del cliente (temp o registrado) provisto por el asesor comercial';

COMMENT ON COLUMN public.private_purchase_requests.equipment IS 'Lista de equipos seleccionados para esta solicitud (solo activos sin cliente/serie asignada)';

COMMENT ON COLUMN public.private_purchase_requests.status IS 'Estado de la solicitud privada durante la negociación';

COMMENT ON COLUMN public.private_purchase_requests.offer_document_id IS 'Document ID de la oferta generada en Drive';

COMMENT ON COLUMN public.private_purchase_requests.offer_signed_document_id IS 'Document ID de la oferta firmada cargada por el comercial';

COMMENT ON COLUMN public.private_purchase_requests.forwarded_to_acp_at IS 'Fecha en que backoffice envió la solicitud a ACP tras registro del cliente';
