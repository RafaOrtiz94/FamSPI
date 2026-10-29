-- 320_crm_account_swot.sql
-- CRM-Fam: analisis FODA (SWOT) de la cuenta, asistido con datos del CRM.
--  * crm_account_swot_items: items por cuadrante, manuales o aceptados desde una sugerencia.
--    Las sugerencias descartadas se guardan con status 'dismissed' para no volver a proponerlas.
--  * crm_account_swot_versions: instantaneas explicitas ("Guardar version") para ver la evolucion.

CREATE TABLE IF NOT EXISTS crm.crm_account_swot_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES crm.crm_accounts(id),
  plan_id uuid REFERENCES crm.crm_account_plans(id) ON DELETE SET NULL,
  quadrant varchar(20) NOT NULL CHECK (quadrant IN ('strength', 'opportunity', 'weakness', 'threat')),
  title varchar(200) NOT NULL,
  description text,
  impact varchar(10) NOT NULL DEFAULT 'medium' CHECK (impact IN ('high', 'medium', 'low')),
  source varchar(10) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'auto')),
  source_key varchar(120),
  status varchar(15) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dismissed')),
  deleted_at timestamptz,
  created_by integer REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by integer REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_account_swot_items_account
  ON crm.crm_account_swot_items (account_id)
  WHERE deleted_at IS NULL;

-- Una sugerencia (clave de regla + entidad) solo puede estar aceptada o descartada una vez por cuenta.
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_account_swot_items_source_key
  ON crm.crm_account_swot_items (account_id, source_key)
  WHERE source_key IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS crm.crm_account_swot_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES crm.crm_accounts(id),
  plan_id uuid REFERENCES crm.crm_account_plans(id) ON DELETE SET NULL,
  version_number integer NOT NULL,
  note varchar(300),
  snapshot jsonb NOT NULL,
  created_by integer REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_crm_account_swot_versions_account
  ON crm.crm_account_swot_versions (account_id, version_number DESC);
