-- Migration: 205_collab_sessions.sql
-- Propósito: Sesiones de entrega multi-ítem por categoría (1 acta por categoría).
-- Modelo: una sesión = un colaborador + N ítems de la MISMA categoría = 1 acta.
-- Idempotente: IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.

-- ─── collab_delivery_sessions ────────────────────────────────────────────────
-- Agrupa múltiples collab_deliveries de la misma categoría bajo una sesión → una acta.
CREATE TABLE IF NOT EXISTS public.collab_delivery_sessions (
  id           BIGSERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  category     TEXT    NOT NULL CHECK (category IN ('ropa','herramienta','logistica')),
  session_date DATE    NOT NULL DEFAULT CURRENT_DATE,
  tipo         TEXT    NOT NULL DEFAULT 'entrega' CHECK (tipo IN ('entrega','retiro')),
  notes        TEXT,
  created_by   INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collab_sessions_user
  ON public.collab_delivery_sessions(user_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_collab_sessions_category
  ON public.collab_delivery_sessions(category, session_date DESC);

-- ─── Vincular collab_deliveries → session ────────────────────────────────────
ALTER TABLE public.collab_deliveries
  ADD COLUMN IF NOT EXISTS session_id BIGINT
    REFERENCES public.collab_delivery_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_collab_deliveries_session
  ON public.collab_deliveries(session_id);

-- ─── Vincular collab_delivery_actas → session ────────────────────────────────
ALTER TABLE public.collab_delivery_actas
  ADD COLUMN IF NOT EXISTS session_id BIGINT
    REFERENCES public.collab_delivery_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_collab_actas_session
  ON public.collab_delivery_actas(session_id);

-- ─── Enriquecer collab_delivery_actas_items ───────────────────────────────────
-- brand_model: para ítems TI (celular, laptop) incluidos en actas de comunicación
-- item_category: para identificar tipo dentro de un acta mixta de categoría
ALTER TABLE public.collab_delivery_actas_items
  ADD COLUMN IF NOT EXISTS brand_model TEXT;
ALTER TABLE public.collab_delivery_actas_items
  ADD COLUMN IF NOT EXISTS item_category TEXT;
