-- Fase 3 / 316 (plan RBAC): asignaciones de roles y grants individuales SIN tenant.
-- 286 ata user_roles a tenant_memberships, y el tenant esta fuera de alcance (restriccion 12),
-- asi que las asignaciones de este plan van por usuario. Tablas nuevas y vacias: no cambian
-- ninguna decision de acceso hasta que el motor central se active por bandera.

CREATE TABLE IF NOT EXISTS public.user_role_assignments (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id BIGINT NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('legacy_role', 'legacy_scope', 'legacy_extra_role', 'manual')),
  reason TEXT,
  assigned_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (expires_at IS NULL OR starts_at IS NULL OR expires_at >= starts_at)
);

-- Una asignacion vigente por usuario, rol y origen; las revocadas quedan como historial.
CREATE UNIQUE INDEX IF NOT EXISTS ux_user_role_assignments_active
  ON public.user_role_assignments(user_id, role_id, source)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_role_assignments_user
  ON public.user_role_assignments(user_id)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.user_permission_grants (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  assigned_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (expires_at IS NULL OR starts_at IS NULL OR expires_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS idx_user_permission_grants_user
  ON public.user_permission_grants(user_id)
  WHERE revoked_at IS NULL;

-- Que permiso exige cada endpoint. La clave es el metodo y el patron de ruta tal como lo registra Express.
CREATE TABLE IF NOT EXISTS public.rbac_endpoint_permissions (
  method TEXT NOT NULL,
  route_pattern TEXT NOT NULL,
  permission_key TEXT NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (method, route_pattern)
);

CREATE INDEX IF NOT EXISTS idx_rbac_endpoint_permissions_permission
  ON public.rbac_endpoint_permissions(permission_key);

COMMENT ON TABLE public.user_role_assignments IS
  'Roles de un usuario sin tenant. source indica si viene de users.role, del scope derivado, de extra_roles o de una asignacion manual.';
COMMENT ON TABLE public.user_permission_grants IS
  'Permisos individuales con motivo, vigencia y revocacion. Solo suman; no existe denegacion explicita.';
COMMENT ON TABLE public.rbac_endpoint_permissions IS
  'Mapa endpoint -> permiso generado desde las guardas vigentes (scripts/rbac/seed_rbac_catalog.js).';
