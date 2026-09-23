-- Permite adjuntar imagenes a una nota normal (no solo al registro de un
-- correo). Mismo criterio que email_meta.attachments: solo se guarda
-- metadata + link de Drive, no el binario en la fila.
ALTER TABLE public.process_notes
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;
