-- 301_crm_accounts_classification_sales_target.sql
-- CRM-Fam: clasificacion de cuentas (oro/plata/bronce/normal) + meta de
-- ventas por cuenta, para poder calcular estadisticas de proyeccion
-- comercial (vendido vs meta, oportunidades faltantes, % ganados/perdidos).

ALTER TABLE crm.crm_accounts
  ADD COLUMN IF NOT EXISTS classification varchar(20),
  ADD COLUMN IF NOT EXISTS sales_target_amount numeric(15,2);

ALTER TABLE crm.crm_accounts
  DROP CONSTRAINT IF EXISTS crm_accounts_classification_check;

ALTER TABLE crm.crm_accounts
  ADD CONSTRAINT crm_accounts_classification_check
  CHECK (classification IS NULL OR classification IN ('oro', 'plata', 'bronce', 'normal'));

CREATE INDEX IF NOT EXISTS idx_crm_accounts_classification
  ON crm.crm_accounts (classification)
  WHERE deleted_at IS NULL;
