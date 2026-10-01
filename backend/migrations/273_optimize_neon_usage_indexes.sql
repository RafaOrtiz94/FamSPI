-- 273_optimize_neon_usage_indexes.sql
-- Indices para las queries mas frecuentes que hoy hacen sequential scan:
--   - jobs de permisos/vacaciones que filtran por LOWER(COALESCE(status,''))
--     y columnas relacionadas (corren cada 15-60 min sobre toda la tabla)
--   - listado/conteo de auditoria.logs (ORDER BY creado_en DESC + filtros
--     por modulo/usuario/fecha), tabla que crece con cada POST/PUT/PATCH/DELETE
--
-- CONCURRENTLY: cada CREATE INDEX corre fuera de una transaccion explicita,
-- para no bloquear escrituras mientras se construye el indice. Aplicar
-- manualmente (psql -f), no dentro de un bloque BEGIN/COMMIT.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_permisos_vacaciones_status_lower
  ON public.permisos_vacaciones (LOWER(COALESCE(status, '')));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_permisos_vacaciones_justificante_status_lower
  ON public.permisos_vacaciones (LOWER(COALESCE(justificante_status, '')));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_permisos_vacaciones_recovery_status_lower
  ON public.permisos_vacaciones (LOWER(COALESCE(recovery_coordination_status, '')))
  WHERE es_recuperable = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_permisos_vacaciones_escalation_status
  ON public.permisos_vacaciones (escalation_status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vacaciones_solicitudes_status_lower
  ON public.vacaciones_solicitudes (LOWER(COALESCE(status, '')));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auditoria_logs_creado_en
  ON auditoria.logs (creado_en DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auditoria_logs_modulo_lower
  ON auditoria.logs (LOWER(modulo));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auditoria_logs_usuario_email_lower
  ON auditoria.logs (LOWER(usuario_email));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auditoria_logs_usuario_id
  ON auditoria.logs (usuario_id);
