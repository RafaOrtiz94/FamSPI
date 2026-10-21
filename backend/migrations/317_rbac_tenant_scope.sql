-- Fase 3 / 317 (plan RBAC, enfoque SaaS, paso 2): empresa en las tablas propias del catalogo central.
-- Solo aditivo y solo sobre tablas creadas por 316 (que ningun otro modulo lee): columnas nulas, sin default
-- y sin cambiar ninguna fila. Mientras RBAC_TENANT_MODE este apagado, nada del sistema las consulta.
-- No toca users, user_module_access, tablas de negocio, el token ni requireRole.

ALTER TABLE public.user_role_assignments
  ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE public.user_permission_grants
  ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES public.tenants(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_user_role_assignments_tenant
  ON public.user_role_assignments(tenant_id) WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_permission_grants_tenant
  ON public.user_permission_grants(tenant_id) WHERE revoked_at IS NULL;

-- Un usuario puede tener el mismo rol manual en dos empresas distintas: la unicidad pasa a incluir la empresa.
-- Con tenant_id nulo (hoy, siempre) COALESCE da 0 y la regla es identica a la de 316.
CREATE UNIQUE INDEX IF NOT EXISTS ux_user_role_assignments_active_tenant
  ON public.user_role_assignments(user_id, role_id, source, (COALESCE(tenant_id, 0)))
  WHERE revoked_at IS NULL;

DROP INDEX IF EXISTS public.ux_user_role_assignments_active;

COMMENT ON COLUMN public.user_role_assignments.tenant_id IS
  'Empresa de la asignacion manual. NULL = heredada de users.role (aplica en todas las empresas del usuario) o anterior al modo multiempresa.';
COMMENT ON COLUMN public.user_permission_grants.tenant_id IS
  'Empresa del permiso individual. NULL = anterior al modo multiempresa.';
