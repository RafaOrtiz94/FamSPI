-- 318_crm_account_plans.sql
-- CRM-Fam: una cuenta puede tener varios planes de cuenta (meta de ventas por
-- periodo y vendedor). Reemplaza la meta unica crm_accounts.sales_target_amount,
-- que se conserva solo como dato historico (ya no se escribe desde el servicio).

CREATE TABLE IF NOT EXISTS crm.crm_account_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES crm.crm_accounts(id),
  name varchar(150) NOT NULL,
  period_start date,
  period_end date,
  target_amount numeric(15,2) NOT NULL CHECK (target_amount >= 0),
  seller_user_id integer REFERENCES public.users(id),
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  notes text,
  deleted_at timestamptz,
  created_by integer REFERENCES public.users(id),
  updated_by integer REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_account_plans_period_check
    CHECK (period_start IS NULL OR period_end IS NULL OR period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS idx_crm_account_plans_account
  ON crm.crm_account_plans (account_id)
  WHERE deleted_at IS NULL;

-- Backfill: cada cuenta con meta pasa a tener un "Plan inicial" (sin periodo,
-- vendedor = propietario de la cuenta). Idempotente: no duplica si ya hay planes.
INSERT INTO crm.crm_account_plans (account_id, name, target_amount, seller_user_id, created_by, updated_by)
SELECT a.id, 'Plan inicial', a.sales_target_amount, a.owner_user_id, a.updated_by, a.updated_by
  FROM crm.crm_accounts a
 WHERE a.sales_target_amount IS NOT NULL
   AND a.deleted_at IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM crm.crm_account_plans p WHERE p.account_id = a.id
   );
