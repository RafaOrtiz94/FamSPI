-- 324_crm_sales_goals.sql
-- Meta de venta mensual por vendedor. Una fila por vendedor y mes (period_month = dia 1 del mes).
-- Idempotente.

CREATE TABLE IF NOT EXISTS crm.crm_sales_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id integer NOT NULL REFERENCES public.users(id),
  period_month date NOT NULL CHECK (EXTRACT(DAY FROM period_month) = 1),
  target_amount numeric(15,2) NOT NULL CHECK (target_amount >= 0),
  created_by integer REFERENCES public.users(id),
  updated_by integer REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_sales_goals_user_month_key UNIQUE (user_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_crm_sales_goals_month ON crm.crm_sales_goals (period_month);
