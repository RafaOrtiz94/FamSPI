-- 170_workflow_alignment_part2.sql
-- Continuación de 130_workflow_alignment.sql
-- Agrega campos faltantes a equipment_purchase_requests según WORKFLOW_PROPUESTA_ALINEADA_FINAL.md

-- =========================================================
-- 1. purchase_type y private_modality en equipment_purchase_requests
-- =========================================================
-- purchase_type: public | private
-- private_modality: direct_sale | rental | rental_with_domain_transfer | comodato (solo cuando purchase_type = private)

ALTER TABLE public.equipment_purchase_requests
  ADD COLUMN IF NOT EXISTS purchase_type TEXT
    CHECK (purchase_type IN ('public', 'private'))
    DEFAULT 'public';

ALTER TABLE public.equipment_purchase_requests
  ADD COLUMN IF NOT EXISTS private_modality TEXT
    CHECK (private_modality IN (
      'direct_sale',
      'rental',
      'rental_with_domain_transfer',
      'comodato'
    ));

-- Migrar registros existentes a purchase_type = 'public'
UPDATE public.equipment_purchase_requests
  SET purchase_type = 'public'
  WHERE purchase_type IS NULL OR purchase_type NOT IN ('public', 'private');

COMMENT ON COLUMN public.equipment_purchase_requests.purchase_type IS
  'Tipo de compra: public (licitaciones) o private (clientes privados)';

COMMENT ON COLUMN public.equipment_purchase_requests.private_modality IS
  'Modalidad privada: direct_sale, rental, rental_with_domain_transfer, comodato. Solo aplica cuando purchase_type = private.';

-- =========================================================
-- 2. requires_business_case (campo calculado o derivado)
-- =========================================================
-- Regla:
--   true si purchase_type = 'public' OR private_modality = 'comodato'
--   false en los demás casos

ALTER TABLE public.equipment_purchase_requests
  ADD COLUMN IF NOT EXISTS requires_business_case BOOLEAN
    GENERATED ALWAYS AS (
      CASE
        WHEN purchase_type = 'public' THEN true
        WHEN private_modality = 'comodato' THEN true
        ELSE false
      END
    ) STORED;

COMMENT ON COLUMN public.equipment_purchase_requests.requires_business_case IS
  'true = requiere Business Case (pública o comodato), false = no requiere BC';

-- =========================================================
-- 3. availability_source
-- =========================================================

ALTER TABLE public.equipment_purchase_requests
  ADD COLUMN IF NOT EXISTS availability_source TEXT
    CHECK (availability_source IN ('internal', 'supplier'));

COMMENT ON COLUMN public.equipment_purchase_requests.availability_source IS
  'Fuente de disponibilidad: internal (equipo interno listo) o supplier (proveedor)';

-- =========================================================
-- 4. supply_control_type
-- =========================================================

ALTER TABLE public.equipment_purchase_requests
  ADD COLUMN IF NOT EXISTS supply_control_type TEXT
    CHECK (supply_control_type IN (
      'bc_maximums',
      'commercial_deliverables',
      'none',
      'pending'
    ))
    DEFAULT 'pending';

COMMENT ON COLUMN public.equipment_purchase_requests.supply_control_type IS
  'Tipo de control de insumos: bc_maximums (pública/comodato), commercial_deliverables (privada con entregables), none (sin control), pending (aún no derivado)';

-- =========================================================
-- Índices de soporte
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_epr_purchase_type
  ON public.equipment_purchase_requests (purchase_type)
  WHERE purchase_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_epr_requires_business_case
  ON public.equipment_purchase_requests (requires_business_case)
  WHERE requires_business_case IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_epr_supply_control_type
  ON public.equipment_purchase_requests (supply_control_type)
  WHERE supply_control_type IS NOT NULL;

-- =========================================================
-- Registro de migración
-- =========================================================

INSERT INTO migration_audit_log (
  migration_name,
  phase,
  operation,
  table_name,
  rows_affected,
  details,
  success
) VALUES (
  '170_workflow_alignment_part2',
  'schema_extension',
  'add_workflow_alignment_columns_part2',
  'equipment_purchase_requests',
  0,
  'Alineación workflow parte 2: purchase_type, private_modality, requires_business_case, availability_source, supply_control_type',
  true
);
