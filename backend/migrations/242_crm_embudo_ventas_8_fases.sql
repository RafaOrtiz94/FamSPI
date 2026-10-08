-- Migration: 242_crm_embudo_ventas_8_fases.sql
-- Reemplaza las 12 etapas genericas de crm.crm_pipeline_stages por las 6 etapas
-- reales del embudo de ventas (Fase 3 a Fase 8; Fase 1/2 son leads, no oportunidades).
-- Las 12 etapas viejas se desactivan (is_active=false), no se borran, para no romper
-- referencias historicas. Las oportunidades existentes se remapean a la etapa nueva
-- mas parecida.

INSERT INTO crm.crm_pipeline_stages (id, name, description, order_index, probability_default, requires_blue_sheet, is_active)
VALUES
  (gen_random_uuid(), 'Análisis de la oportunidad', 'Evaluacion inicial de la oportunidad recien creada desde un lead calificado', 1, 15, false, true),
  (gen_random_uuid(), 'Desarrollo de la oferta', 'Elaboracion de la oferta: proceso de compra, comodato o venta segun corresponda', 2, 35, true, true),
  (gen_random_uuid(), 'Presentación de la oferta', 'Oferta presentada al cliente', 3, 50, true, true),
  (gen_random_uuid(), 'Negociación', 'Ajustes finales de condiciones comerciales', 4, 65, true, true),
  (gen_random_uuid(), 'Aceptación o rechazo', 'Decision final del cliente sobre la oferta', 5, 80, true, true),
  (gen_random_uuid(), 'Contratos', 'Formalizacion contractual y cierre', 6, 95, true, true)
ON CONFLICT DO NOTHING;

-- Remapear oportunidades existentes de las 12 etapas viejas a las 6 nuevas.
UPDATE crm.crm_opportunities o
   SET stage_id = new_stage.id
  FROM crm.crm_pipeline_stages old_stage
  JOIN (VALUES
    ('Prospección',          'Análisis de la oportunidad'),
    ('Primer contacto',      'Análisis de la oportunidad'),
    ('Calificación',         'Análisis de la oportunidad'),
    ('Diagnóstico',          'Análisis de la oportunidad'),
    ('Propuesta técnica',    'Desarrollo de la oferta'),
    ('Propuesta económica',  'Desarrollo de la oferta'),
    ('Negociación',          'Negociación'),
    ('Decisión del cliente', 'Aceptación o rechazo'),
    ('Contrato',             'Contratos'),
    ('Cierre ganado',        'Contratos'),
    ('Cierre perdido',       'Contratos'),
    ('Suspendida',           'Desarrollo de la oferta')
  ) AS name_map(old_name, new_name) ON name_map.old_name = old_stage.name
  JOIN crm.crm_pipeline_stages new_stage ON new_stage.name = name_map.new_name AND new_stage.order_index BETWEEN 1 AND 6
 WHERE o.stage_id = old_stage.id
   AND o.deleted_at IS NULL;

-- Desactivar las 12 etapas viejas (quedan para integridad referencial historica).
UPDATE crm.crm_pipeline_stages
   SET is_active = false
 WHERE order_index > 6
    OR name IN ('Prospección','Primer contacto','Calificación','Diagnóstico','Propuesta técnica','Propuesta económica','Decisión del cliente','Contrato','Cierre ganado','Cierre perdido','Suspendida');

-- Columnas puente: enlazar solicitudes externas a la oportunidad que las origino.
ALTER TABLE public.private_purchase_requests
  ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES crm.crm_opportunities(id);

ALTER TABLE public.client_requests
  ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES crm.crm_opportunities(id);

CREATE INDEX IF NOT EXISTS idx_private_purchase_requests_opportunity ON public.private_purchase_requests(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_client_requests_opportunity ON public.client_requests(opportunity_id);
