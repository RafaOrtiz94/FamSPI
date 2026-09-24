-- 274_pasante_local_auth.sql
-- Soporta login sin OAuth (usuarios tipo pasante) + expiracion de cuenta.
-- Ver docs/plans/pasantes-access-plan.md

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'google',
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS account_expires_at TIMESTAMPTZ;

-- Unicidad case-insensitive de username, solo cuando esta presente (la
-- mayoria de usuarios via Google nunca tendran username).
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_username_lower
  ON public.users (LOWER(username))
  WHERE username IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_account_expires_at
  ON public.users (account_expires_at)
  WHERE account_expires_at IS NOT NULL;

COMMENT ON COLUMN public.users.password_hash IS 'bcrypt hash, solo para auth_provider=local (pasantes). NULL para usuarios Google.';
COMMENT ON COLUMN public.users.username IS 'Identificador de login local, independiente de email. Unico case-insensitive.';
COMMENT ON COLUMN public.users.auth_provider IS 'google | local. Determina si el login pasa por OAuth o por POST /auth/local-login.';
COMMENT ON COLUMN public.users.must_change_password IS 'true tras alta o reset admin -- fuerza POST /auth/change-password antes de emitir JWT completo.';
COMMENT ON COLUMN public.users.account_expires_at IS 'Fin de pasantia. NULL = sin vencimiento (usuarios permanentes). Login rechazado si ya paso.';
