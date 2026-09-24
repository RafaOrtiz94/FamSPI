-- Permite varias evidencias fotograficas por ticket sin alterar adjuntos existentes.
DROP INDEX IF EXISTS public.idx_support_ticket_attachments_ticket_unique;

CREATE INDEX IF NOT EXISTS idx_support_ticket_attachments_ticket
  ON public.support_ticket_attachments (ticket_id, created_at, id);

COMMENT ON TABLE public.support_ticket_attachments IS
  'Evidencias fotograficas opcionales asociadas a tickets de soporte TI.';
