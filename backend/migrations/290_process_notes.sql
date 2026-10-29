-- Sistema de notas append-only por proceso (Business Case, compra publica,
-- compra privada). Ninguna nota es editable ni borrable -- solo se puede
-- responder (parent_note_id), igual que un hilo de WhatsApp/Telegram.
-- Cada nota encadena su hash con la anterior DEL MISMO hilo (mismo patron ya
-- usado en signature_workflow_signers: payload_hash + previous_hash).

CREATE TABLE IF NOT EXISTS public.process_notes (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('business_case', 'public_purchase', 'private_purchase')),
  entity_id TEXT NOT NULL,
  parent_note_id BIGINT REFERENCES public.process_notes(id) ON DELETE RESTRICT,
  author_id INTEGER NOT NULL REFERENCES public.users(id),
  author_name_snapshot TEXT NOT NULL,
  author_role_snapshot TEXT,
  body TEXT NOT NULL CHECK (length(trim(body)) > 0 AND length(body) <= 4000),
  mentioned_user_ids INTEGER[] NOT NULL DEFAULT '{}',
  payload_hash_sha256 TEXT NOT NULL,
  previous_note_hash_sha256 TEXT,
  note_hash_sha256 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_process_notes_entity
  ON public.process_notes (entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_process_notes_parent
  ON public.process_notes (parent_note_id);

-- Defensa en profundidad: ademas de nunca exponer un endpoint PATCH/DELETE,
-- la base de datos misma rechaza cualquier intento de modificar o borrar una
-- nota ya escrita.
CREATE OR REPLACE FUNCTION public.reject_process_notes_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'process_notes es append-only: las notas no se editan ni se borran';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_process_notes_no_update ON public.process_notes;
CREATE TRIGGER trg_process_notes_no_update
  BEFORE UPDATE OR DELETE ON public.process_notes
  FOR EACH ROW EXECUTE FUNCTION public.reject_process_notes_mutation();

-- Recibos de lectura ("visto por") por nota y usuario.
CREATE TABLE IF NOT EXISTS public.process_note_reads (
  note_id BIGINT NOT NULL REFERENCES public.process_notes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES public.users(id),
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (note_id, user_id)
);
