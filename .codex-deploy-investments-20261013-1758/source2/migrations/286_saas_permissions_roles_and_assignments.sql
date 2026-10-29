-- Fase 2 / 286: permisos, roles y asignaciones con alcance por tenant.
-- Tablas nuevas vacias; no migra users.role ni users.extra_roles automaticamente.

CREATE TABLE IF NOT EXISTS public.permissions (
  key TEXT PRIMARY KEY,
  module_key TEXT REFERENCES public.modules(key) ON DELETE RESTRICT,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT NOT NULL,
  is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (module_key, resource, action)
);

CREATE TABLE IF NOT EXISTS public.roles (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT REFERENCES public.tenants(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, key)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_roles_global_key
  ON public.roles(key)
  WHERE tenant_id IS NULL;

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id BIGINT NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_key
  ON public.role_permissions(permission_key);

CREATE TABLE IF NOT EXISTS public.user_roles (
  membership_id BIGINT NOT NULL REFERENCES public.tenant_memberships(id) ON DELETE CASCADE,
  role_id BIGINT NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  assigned_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (membership_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_role_id
  ON public.user_roles(role_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_expiration
  ON public.user_roles(expires_at)
  WHERE expires_at IS NOT NULL;

COMMENT ON TABLE public.permissions IS
  'Catalogo de capacidades canonicas; se poblara despues de aprobar la matriz funcional.';

COMMENT ON TABLE public.roles IS
  'Roles globales o por tenant. users.role permanece como compatibilidad durante la migracion.';
