-- "Apoyo" (work_management.followers) ahora guarda el contexto de que se le
-- esta pidiendo a la persona, quien la asigno y cuando -- antes solo existia
-- item_id/user_id. Todo aditivo/nullable: filas anteriores a esta migracion
-- quedan con estos tres campos en NULL, el frontend debe mostrar
-- "Sin contexto registrado" para esos casos en vez de asumir que siempre hay dato.

ALTER TABLE work_management.followers
  ADD COLUMN IF NOT EXISTS context TEXT,
  ADD COLUMN IF NOT EXISTS assigned_by INT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
