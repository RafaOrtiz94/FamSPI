ALTER TABLE public.signature_workflow_signers
  ADD COLUMN IF NOT EXISTS cedula_snapshot TEXT;
