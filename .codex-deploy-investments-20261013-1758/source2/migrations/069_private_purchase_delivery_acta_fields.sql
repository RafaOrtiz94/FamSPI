DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relkind = 'S'
      AND relname = 'private_purchase_delivery_act_seq'
  ) THEN
    CREATE SEQUENCE private_purchase_delivery_act_seq START 1;
  END IF;
END $$;

ALTER TABLE public.private_purchase_requests
  ADD COLUMN IF NOT EXISTS delivery_act_number character varying(50),
  ADD COLUMN IF NOT EXISTS delivery_act_dispatched_by character varying(255),
  ADD COLUMN IF NOT EXISTS delivery_act_dispatched_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS delivery_act_delivered_by character varying(255),
  ADD COLUMN IF NOT EXISTS delivery_act_delivered_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS delivery_act_observations_json jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS delivery_act_draft_document_id character varying(255),
  ADD COLUMN IF NOT EXISTS delivery_act_draft_generated_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS delivery_act_generated_at timestamp with time zone;

COMMENT ON COLUMN public.private_purchase_requests.delivery_act_number IS 'Numero unico de acta de entrega/recepcion';
COMMENT ON COLUMN public.private_purchase_requests.delivery_act_dispatched_by IS 'Nombre de quien despacha (logistica)';
COMMENT ON COLUMN public.private_purchase_requests.delivery_act_dispatched_at IS 'Fecha de despacho del acta';
COMMENT ON COLUMN public.private_purchase_requests.delivery_act_delivered_by IS 'Nombre de quien entrega (jefe tecnico)';
COMMENT ON COLUMN public.private_purchase_requests.delivery_act_delivered_at IS 'Fecha de entrega registrada por jefe tecnico';
COMMENT ON COLUMN public.private_purchase_requests.delivery_act_observations_json IS 'Observaciones del acta de entrega (array)';
COMMENT ON COLUMN public.private_purchase_requests.delivery_act_draft_document_id IS 'Documento Drive del acta borrador generado por logistica';
COMMENT ON COLUMN public.private_purchase_requests.delivery_act_draft_generated_at IS 'Fecha de generacion del acta borrador';
COMMENT ON COLUMN public.private_purchase_requests.delivery_act_generated_at IS 'Fecha de generacion del acta final';
