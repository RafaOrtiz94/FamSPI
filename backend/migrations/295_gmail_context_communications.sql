-- Registro idempotente de comunicaciones abiertas desde Gmail Workspace.
-- No crea clientes ni procesos: una comunicacion queda pendiente hasta que un
-- usuario autorizado la vincule manualmente a un proceso existente.

CREATE TABLE IF NOT EXISTS public.gmail_context_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_email TEXT NOT NULL,
  gmail_message_id TEXT NOT NULL,
  gmail_thread_id TEXT,
  sender_email TEXT,
  recipient_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
  subject TEXT,
  received_at TIMESTAMPTZ,
  body_preview TEXT,
  status TEXT NOT NULL DEFAULT 'pending_link'
    CHECK (status IN ('pending_link', 'linked', 'new_client_requested', 'discarded')),
  client_request_id INTEGER REFERENCES public.client_requests(id) ON DELETE SET NULL,
  linked_entity_type TEXT CHECK (linked_entity_type IN ('business_case', 'public_purchase', 'private_purchase')),
  linked_entity_id TEXT,
  process_note_id BIGINT REFERENCES public.process_notes(id) ON DELETE SET NULL,
  registered_by_user_id INTEGER NOT NULL REFERENCES public.users(id),
  linked_by_user_id INTEGER REFERENCES public.users(id),
  linked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gmail_context_communications_link_consistency CHECK (
    (status = 'linked' AND linked_entity_type IS NOT NULL AND linked_entity_id IS NOT NULL AND process_note_id IS NOT NULL)
    OR (status <> 'linked')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_gmail_context_communications_mailbox_message
  ON public.gmail_context_communications (lower(mailbox_email), gmail_message_id);

CREATE INDEX IF NOT EXISTS idx_gmail_context_communications_owner_status
  ON public.gmail_context_communications (registered_by_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gmail_context_communications_thread
  ON public.gmail_context_communications (gmail_thread_id)
  WHERE gmail_thread_id IS NOT NULL;

ALTER TABLE public.process_notes
  ADD COLUMN IF NOT EXISTS source_communication_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'process_notes_source_communication_id_fkey'
      AND conrelid = 'public.process_notes'::regclass
  ) THEN
    ALTER TABLE public.process_notes
      ADD CONSTRAINT process_notes_source_communication_id_fkey
      FOREIGN KEY (source_communication_id)
      REFERENCES public.gmail_context_communications(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_process_notes_source_communication
  ON public.process_notes (source_communication_id)
  WHERE source_communication_id IS NOT NULL;
