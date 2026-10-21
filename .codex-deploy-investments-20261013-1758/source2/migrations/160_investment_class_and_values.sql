-- Migration 160: investment_class en catálogo + unit_price_financial en selecciones + deadline tracking en BC

-- 1. Clasificación operativa/financiera en catálogo
ALTER TABLE public.bc_investment_catalog
  ADD COLUMN IF NOT EXISTS investment_class VARCHAR(20) NOT NULL DEFAULT 'operativa'
  CHECK (investment_class IN ('operativa', 'financiera'));

-- 2. Precio final por el jefe_financiero (el unit_price existente queda para jefe_operaciones)
ALTER TABLE public.bc_investment_selections
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS unit_price_financial NUMERIC(12,2);

-- 3. Tracking de cuándo cambiaron selecciones (para calcular deadline 48h)
ALTER TABLE public.equipment_purchase_requests
  ADD COLUMN IF NOT EXISTS invest_selections_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invest_values_op_deadline_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invest_values_fin_deadline_at TIMESTAMPTZ;

-- 4. Clasificar ítems existentes como financiera (servicios, seguros, mantenimientos)
UPDATE public.bc_investment_catalog
SET investment_class = 'financiera'
WHERE name IN (
  'Control externo de tercera opinión',
  'Control interno interlaboratorial',
  'Póliza de Fiel Cumplimiento del Contrato',
  'Póliza de seguro de equipos',
  'LIS',
  'Interfaz',
  'IP publica',
  'Internet',
  'Servicio Logisticos Proveedores',
  'Servicio Logisticos Clientes',
  'Mantenimiento Computador',
  'Mantenimiento sistema de osmosis',
  'Mantenimiento sistema pre filtración',
  'Climatizacion del area',
  'Modificaciones de espacio fisico - estructura',
  'Modificaciones de espacio fisico - mobiliario'
);

-- 5. Índice para búsquedas por clase
CREATE INDEX IF NOT EXISTS idx_bc_investment_catalog_class
  ON public.bc_investment_catalog (investment_class);

COMMENT ON COLUMN public.bc_investment_catalog.investment_class IS 'operativa = producto/adquisición (jefe_operaciones); financiera = servicio/mano de obra (jefe_financiero)';
COMMENT ON COLUMN public.bc_investment_selections.unit_price IS 'Precio unitario operativo — llenado por jefe_operaciones';
COMMENT ON COLUMN public.bc_investment_selections.unit_price_financial IS 'Precio unitario financiero — llenado por jefe_financiero';
COMMENT ON COLUMN public.equipment_purchase_requests.invest_selections_changed_at IS 'Última vez que se guardaron cambios en selecciones de inversiones';
COMMENT ON COLUMN public.equipment_purchase_requests.invest_values_op_deadline_at IS 'Deadline 48h para que jefe_operaciones llene valores operativos';
COMMENT ON COLUMN public.equipment_purchase_requests.invest_values_fin_deadline_at IS 'Deadline 48h para que jefe_financiero llene valores financieros';
