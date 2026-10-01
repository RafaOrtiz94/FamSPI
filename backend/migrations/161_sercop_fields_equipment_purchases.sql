-- 161_sercop_fields_equipment_purchases.sql
-- Objetivo:
-- Agregar campos de auditoría SERCOP/SOCE a equipment_purchase_requests.
-- FamSPI actúa como proveedor en el sistema de contratación pública del Ecuador (LOSNCP).
-- Sin estos campos el expediente no puede usarse para trazabilidad legal del proceso.

ALTER TABLE public.equipment_purchase_requests
  -- Tipo de procedimiento SERCOP
  ADD COLUMN IF NOT EXISTS procedure_type VARCHAR(60)
    CHECK (procedure_type IN (
      'catalogo_electronico',
      'infima_cuantia',
      'subasta_inversa_electronica',
      'menor_cuantia',
      'cotizacion',
      'licitacion',
      'regimen_especial'
    )),

  -- Código único del proceso en el portal SOCE (ej: SIE-HCAM-2025-0042)
  ADD COLUMN IF NOT EXISTS soce_process_code VARCHAR(120),

  -- Entidad contratante
  ADD COLUMN IF NOT EXISTS entidad_contratante_name VARCHAR(250),
  ADD COLUMN IF NOT EXISTS entidad_contratante_ruc  VARCHAR(13),

  -- Presupuesto referencial publicado en la convocatoria
  ADD COLUMN IF NOT EXISTS presupuesto_referencial NUMERIC(15, 2),

  -- Fechas del proceso en SOCE
  ADD COLUMN IF NOT EXISTS oferta_tecnica_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS puja_date DATE,

  -- Resultado de la puja
  ADD COLUMN IF NOT EXISTS puja_final_price NUMERIC(15, 2),

  -- Resolución de Adjudicación emitida por la entidad contratante
  ADD COLUMN IF NOT EXISTS adjudicacion_resolution_number VARCHAR(120),
  ADD COLUMN IF NOT EXISTS adjudicacion_resolution_date   DATE,
  ADD COLUMN IF NOT EXISTS adjudicacion_resolution_file_id VARCHAR(500),  -- ID del archivo en Drive

  -- Orden de Compra emitida por SOCE (o número de contrato en Licitación)
  ADD COLUMN IF NOT EXISTS orden_compra_number VARCHAR(120),

  -- Garantía de Fiel Cumplimiento (5% del valor adjudicado)
  ADD COLUMN IF NOT EXISTS garantia_fiel_cumplimiento_submitted BOOLEAN NOT NULL DEFAULT FALSE,

  -- Actas de recepción de la entidad contratante (complementan F.ST-10 interno)
  ADD COLUMN IF NOT EXISTS acta_recepcion_provisional_date DATE,
  ADD COLUMN IF NOT EXISTS acta_recepcion_definitiva_date  DATE,

  -- Código del ítem en el PAC de la entidad (Plan Anual de Contrataciones)
  ADD COLUMN IF NOT EXISTS pac_code VARCHAR(120);

-- Índice para búsqueda por código SOCE (frecuente en operaciones)
CREATE INDEX IF NOT EXISTS idx_epr_soce_process_code
  ON public.equipment_purchase_requests (soce_process_code)
  WHERE soce_process_code IS NOT NULL;

-- Índice por tipo de procedimiento para filtros y reportes
CREATE INDEX IF NOT EXISTS idx_epr_procedure_type
  ON public.equipment_purchase_requests (procedure_type)
  WHERE procedure_type IS NOT NULL;

COMMENT ON COLUMN public.equipment_purchase_requests.procedure_type IS 'Tipo de procedimiento SERCOP: catalogo_electronico, infima_cuantia, subasta_inversa_electronica, menor_cuantia, cotizacion, licitacion, regimen_especial';
COMMENT ON COLUMN public.equipment_purchase_requests.soce_process_code IS 'Código del proceso en el portal SOCE (ej: SIE-HCAM-2025-0042). Identificador oficial del proceso de contratación.';
COMMENT ON COLUMN public.equipment_purchase_requests.entidad_contratante_name IS 'Nombre de la entidad contratante (hospital, ministerio, institución pública)';
COMMENT ON COLUMN public.equipment_purchase_requests.entidad_contratante_ruc IS 'RUC de la entidad contratante (13 dígitos)';
COMMENT ON COLUMN public.equipment_purchase_requests.presupuesto_referencial IS 'Monto máximo publicado por la entidad en la convocatoria (USD)';
COMMENT ON COLUMN public.equipment_purchase_requests.oferta_tecnica_submitted_at IS 'Fecha y hora en que FamSPI subió la oferta técnica al portal SOCE';
COMMENT ON COLUMN public.equipment_purchase_requests.puja_date IS 'Fecha de la sesión de puja electrónica o negociación en SOCE';
COMMENT ON COLUMN public.equipment_purchase_requests.puja_final_price IS 'Precio final con el que FamSPI ganó la puja (USD). Nulo si no se ganó.';
COMMENT ON COLUMN public.equipment_purchase_requests.adjudicacion_resolution_number IS 'Número de la Resolución de Adjudicación emitida por la entidad contratante';
COMMENT ON COLUMN public.equipment_purchase_requests.adjudicacion_resolution_date IS 'Fecha de la Resolución de Adjudicación';
COMMENT ON COLUMN public.equipment_purchase_requests.adjudicacion_resolution_file_id IS 'ID del archivo PDF de la Resolución de Adjudicación almacenado en Drive';
COMMENT ON COLUMN public.equipment_purchase_requests.orden_compra_number IS 'Número de la Orden de Compra (SIE) o Contrato (Licitación) emitido en SOCE';
COMMENT ON COLUMN public.equipment_purchase_requests.garantia_fiel_cumplimiento_submitted IS 'TRUE cuando FamSPI ha entregado la Garantía de Fiel Cumplimiento (5% del valor adjudicado)';
COMMENT ON COLUMN public.equipment_purchase_requests.acta_recepcion_provisional_date IS 'Fecha del Acta de Recepción Provisional emitida por la entidad contratante';
COMMENT ON COLUMN public.equipment_purchase_requests.acta_recepcion_definitiva_date IS 'Fecha del Acta de Recepción Definitiva emitida por la entidad contratante';
COMMENT ON COLUMN public.equipment_purchase_requests.pac_code IS 'Código del ítem en el Plan Anual de Contrataciones (PAC) de la entidad contratante';
