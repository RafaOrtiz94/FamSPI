-- Migration 211: Store signature visual base64 in signers table
-- Needed to embed the drawn signature trace in the final PDF evidence page.

ALTER TABLE public.signature_workflow_signers
  ADD COLUMN IF NOT EXISTS signature_visual_base64 TEXT;
