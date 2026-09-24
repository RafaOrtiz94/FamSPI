-- Soporta dejar constancia (como nota, append-only) de un correo enviado
-- desde el hilo de notas del proceso, a destinatarios internos y externos,
-- con adjuntos. No se guarda el archivo adjunto en la nota -- solo su
-- nombre/tipo/tamano como evidencia -- el archivo en si viaja unicamente en
-- el correo (no se duplica almacenamiento).

ALTER TABLE public.process_notes
  ADD COLUMN IF NOT EXISTS note_type TEXT NOT NULL DEFAULT 'note' CHECK (note_type IN ('note', 'email')),
  ADD COLUMN IF NOT EXISTS email_meta JSONB;
