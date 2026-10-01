-- Agrega soporte de soft-delete a notificaciones.
-- Las notificaciones "limpiadas" se marcan con cleared_at en lugar de eliminarse,
-- lo que permite mostrarlas en el historial completo.

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS cleared_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_cleared ON notifications (user_id, cleared_at)
  WHERE cleared_at IS NULL;
