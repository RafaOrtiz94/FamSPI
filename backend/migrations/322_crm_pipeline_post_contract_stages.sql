-- 322_crm_pipeline_post_contract_stages.sql
-- El embudo terminaba en "Contratos": las oportunidades con contrato firmado, equipo en entrega o
-- ya entregado no tenian una fase propia. Se agregan las dos fases posteriores al contrato.
-- Idempotente: si la fase ya existe (por nombre) solo se asegura que este activa y en su orden.
--
-- OJO: estos nombres los usa el codigo por coincidencia exacta
-- (crmPurchaseSync.service.js#STAGE_NAMES y crm.constants.js#SOLD_STAGE_NAMES).

INSERT INTO crm.crm_pipeline_stages (name, description, order_index, probability_default, requires_blue_sheet, is_active)
SELECT v.name, v.description, v.order_index, v.probability_default, false, true
  FROM (VALUES
    ('Entrega e instalación', 'Contrato firmado: coordinacion de fechas, despacho, inspeccion y entrega del equipo', 7, 98),
    ('Control de consumibles', 'Equipo entregado: seguimiento del expediente de consumibles del cliente', 8, 100)
  ) AS v(name, description, order_index, probability_default)
 WHERE NOT EXISTS (SELECT 1 FROM crm.crm_pipeline_stages s WHERE s.name = v.name);

UPDATE crm.crm_pipeline_stages s
   SET is_active = true,
       order_index = v.order_index,
       updated_at = now()
  FROM (VALUES ('Entrega e instalación', 7), ('Control de consumibles', 8)) AS v(name, order_index)
 WHERE s.name = v.name
   AND (s.is_active IS DISTINCT FROM true OR s.order_index IS DISTINCT FROM v.order_index);
