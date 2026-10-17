-- 125_integration_product_map.sql
-- Libro de correspondencia SPI <-> Odoo para productos/equipos
-- REQ-SPI-001 + base para INT-ODOO-020 (reporte de cobertura)

CREATE TABLE IF NOT EXISTS public.integration_product_map (
  id BIGSERIAL PRIMARY KEY,
  legacy_code TEXT NULL,
  spi_sku TEXT NULL,
  spi_equipment_model_id INTEGER NULL REFERENCES public.equipment_models(id) ON DELETE SET NULL,
  odoo_product_id INTEGER NULL,
  business_category TEXT NOT NULL DEFAULT 'equipment',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.integration_product_map
  ADD COLUMN IF NOT EXISTS legacy_code TEXT NULL,
  ADD COLUMN IF NOT EXISTS spi_sku TEXT NULL,
  ADD COLUMN IF NOT EXISTS spi_equipment_model_id INTEGER NULL REFERENCES public.equipment_models(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS odoo_product_id INTEGER NULL,
  ADD COLUMN IF NOT EXISTS business_category TEXT NOT NULL DEFAULT 'equipment',
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notes TEXT NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'integration_product_map_business_category_check'
  ) THEN
    ALTER TABLE public.integration_product_map
      ADD CONSTRAINT integration_product_map_business_category_check
      CHECK (
        business_category IN (
          'equipment',
          'reagent',
          'determination',
          'calibrator',
          'control',
          'additional_investment',
          'service'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'integration_product_map_reference_check'
  ) THEN
    ALTER TABLE public.integration_product_map
      ADD CONSTRAINT integration_product_map_reference_check
      CHECK (
        legacy_code IS NOT NULL
        OR spi_sku IS NOT NULL
        OR spi_equipment_model_id IS NOT NULL
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'integration_product_map_active_odoo_required_check'
  ) THEN
    ALTER TABLE public.integration_product_map
      ADD CONSTRAINT integration_product_map_active_odoo_required_check
      CHECK (NOT active OR odoo_product_id IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'integration_product_map_odoo_product_positive_check'
  ) THEN
    ALTER TABLE public.integration_product_map
      ADD CONSTRAINT integration_product_map_odoo_product_positive_check
      CHECK (odoo_product_id IS NULL OR odoo_product_id > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_integration_product_map_active_updated
  ON public.integration_product_map (active, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_integration_product_map_category
  ON public.integration_product_map (business_category, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ux_integration_product_map_active_odoo_product
  ON public.integration_product_map (odoo_product_id)
  WHERE active = TRUE AND odoo_product_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_integration_product_map_active_equipment_model
  ON public.integration_product_map (spi_equipment_model_id)
  WHERE active = TRUE AND spi_equipment_model_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_integration_product_map_active_spi_sku
  ON public.integration_product_map (LOWER(spi_sku))
  WHERE active = TRUE AND spi_sku IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_integration_product_map_active_legacy_code
  ON public.integration_product_map (LOWER(legacy_code))
  WHERE active = TRUE AND legacy_code IS NOT NULL;

COMMENT ON TABLE public.integration_product_map IS
  'Libro de correspondencia entre codigos SPI/legacy y product_id de Odoo.';
