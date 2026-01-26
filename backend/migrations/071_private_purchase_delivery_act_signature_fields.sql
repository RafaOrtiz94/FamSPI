ALTER TABLE public.private_purchase_requests
  ADD COLUMN IF NOT EXISTS delivery_act_assigned_to_user_id integer,
  ADD COLUMN IF NOT EXISTS delivery_act_assigned_to_email character varying(255),
  ADD COLUMN IF NOT EXISTS delivery_act_assigned_to_name character varying(255),
  ADD COLUMN IF NOT EXISTS delivery_act_assigned_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS delivery_act_assigned_by integer,
  ADD COLUMN IF NOT EXISTS delivery_act_logistics_signed_document_id character varying(255),
  ADD COLUMN IF NOT EXISTS delivery_act_logistics_signed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS delivery_act_logistics_signed_by character varying(255);

COMMENT ON COLUMN public.private_purchase_requests.delivery_act_assigned_to_user_id IS 'Usuario tecnico asignado para entrega (id)';
COMMENT ON COLUMN public.private_purchase_requests.delivery_act_assigned_to_email IS 'Correo del tecnico asignado para entrega';
COMMENT ON COLUMN public.private_purchase_requests.delivery_act_assigned_to_name IS 'Nombre del tecnico asignado para entrega';
COMMENT ON COLUMN public.private_purchase_requests.delivery_act_assigned_at IS 'Fecha de asignacion del tecnico';
COMMENT ON COLUMN public.private_purchase_requests.delivery_act_assigned_by IS 'Usuario que asigna el tecnico (jefe tecnico)';
COMMENT ON COLUMN public.private_purchase_requests.delivery_act_logistics_signed_document_id IS 'Documento firmado por logistica';
COMMENT ON COLUMN public.private_purchase_requests.delivery_act_logistics_signed_at IS 'Fecha de carga del documento firmado por logistica';
COMMENT ON COLUMN public.private_purchase_requests.delivery_act_logistics_signed_by IS 'Nombre de quien firma en logistica';
