-- Fase 2 / 284: base multi-tenant aditiva.
-- No crea tenants ni asigna usuarios: el backfill requiere decisión funcional.

CREATE TABLE IF NOT EXISTS public.tenants (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tenant_memberships (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_memberships_user_id
  ON public.tenant_memberships(user_id);

CREATE INDEX IF NOT EXISTS idx_tenant_memberships_tenant_status
  ON public.tenant_memberships(tenant_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS ux_tenant_memberships_one_default_user
  ON public.tenant_memberships(user_id)
  WHERE is_default = TRUE AND status = 'active';

COMMENT ON TABLE public.tenants IS
  'Organizaciones SaaS. Esta tabla se crea vacia hasta definir el tenant inicial.';

COMMENT ON TABLE public.tenant_memberships IS
  'Relacion usuario-organizacion; no se puebla automaticamente durante la migracion inicial.';
