-- Fase 2 / 285: catalogo persistente y entitlements por tenant.
-- El catalogo se poblara en una fase posterior desde MODULE_CATALOG verificado.

CREATE TABLE IF NOT EXISTS public.modules (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tenant_modules (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL REFERENCES public.modules(key) ON DELETE RESTRICT,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  plan_code TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  updated_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, module_key),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS idx_tenant_modules_tenant_enabled
  ON public.tenant_modules(tenant_id, is_enabled);

COMMENT ON TABLE public.modules IS
  'Catalogo persistente de modulos SaaS; inicialmente se mantiene el catalogo de codigo como compatibilidad.';

COMMENT ON TABLE public.tenant_modules IS
  'Entitlements de modulo por tenant; no se pobla hasta definir planes y tenant inicial.';
