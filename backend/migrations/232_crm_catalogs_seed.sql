-- 232_crm_catalogs_seed.sql
-- Seeds iniciales de catalogos CRM-Fam

-- Pipeline stages (12 etapas)
INSERT INTO crm.crm_pipeline_stages (id, name, description, order_index, probability_default, requires_blue_sheet, is_active) VALUES
(gen_random_uuid(), 'Prospección', 'Identificación y calificación inicial del lead', 1, 10, false, true),
(gen_random_uuid(), 'Primer contacto', 'Primer contacto establecido con el prospecto', 2, 15, false, true),
(gen_random_uuid(), 'Calificación', 'Evaluación de necesidades, presupuesto y autoridad', 3, 20, false, true),
(gen_random_uuid(), 'Diagnóstico', 'Levantamiento técnico y análisis de situación actual', 4, 30, false, true),
(gen_random_uuid(), 'Propuesta técnica', 'Elaboración y presentación de solución técnica', 5, 40, true, true),
(gen_random_uuid(), 'Propuesta económica', 'Presentación de oferta comercial y negociación', 6, 50, true, true),
(gen_random_uuid(), 'Negociación', 'Ajustes finales de condiciones comerciales', 7, 65, true, true),
(gen_random_uuid(), 'Decisión del cliente', 'Evaluación final por parte del cliente', 8, 75, true, true),
(gen_random_uuid(), 'Contrato', 'Formalización contractual y firma', 9, 85, true, true),
(gen_random_uuid(), 'Cierre ganado', 'Oportunidad ganada y contrato firmado', 10, 100, false, true),
(gen_random_uuid(), 'Cierre perdido', 'Oportunidad perdida', 11, 0, false, true),
(gen_random_uuid(), 'Suspendida', 'Proceso pausado temporalmente', 12, 0, false, true);

-- Scorecard criteria (10 criterios)
INSERT INTO crm.crm_scorecard_criteria (id, criterion_name, criterion_description, weight, display_order, is_active) VALUES
(gen_random_uuid(), 'Ajuste de solución', 'Qué tan bien nuestra solución responde a las necesidades declaradas del cliente', 15, 1, true),
(gen_random_uuid(), 'Acceso al comprador económico', 'Nivel de acceso y relación con quien toma la decisión de presupuesto', 15, 2, true),
(gen_random_uuid(), 'Identificación de Win-Results', 'Claridad sobre los resultados deseados de cada influencia compradora', 10, 3, true),
(gen_random_uuid(), 'Posición competitiva', 'Ventaja diferencial frente a competidores identificados', 12, 4, true),
(gen_random_uuid(), 'Fortaleza del Coach', 'Calidad y acceso al coach interno que guía nuestra estrategia', 10, 5, true),
(gen_random_uuid(), 'Claridad del proceso de compra', 'Comprensión del proceso formal de decisión y aprobación del cliente', 10, 6, true),
(gen_random_uuid(), 'Urgencia del cliente', 'Nivel real de urgencia y presión para resolver el problema', 8, 7, true),
(gen_random_uuid(), 'Confirmación de presupuesto', 'Estado de confirmación de presupuesto disponible para la compra', 10, 8, true),
(gen_random_uuid(), 'Red Flags controladas', 'Nivel de mitigación de riesgos identificados en la oportunidad', 5, 9, true),
(gen_random_uuid(), 'Plan de acción activo', 'Existencia y avance de acciones concretas con fechas y responsables', 5, 10, true);

-- Lost reasons (11 motivos)
INSERT INTO crm.crm_lost_reasons (id, reason_name, reason_description, is_active, display_order) VALUES
(gen_random_uuid(), 'Precio fuera de rango', 'El cliente optó por una solución más económica o nuestro precio superó el presupuesto', true, 1),
(gen_random_uuid(), 'Competidor ganó', 'El cliente eligió a un competidor directo', true, 2),
(gen_random_uuid(), 'Proyecto cancelado', 'El cliente canceló o postergó indefinidamente el proyecto', true, 3),
(gen_random_uuid(), 'Sin presupuesto aprobado', 'El presupuesto del cliente no fue aprobado internamente', true, 4),
(gen_random_uuid(), 'Sin decisión del cliente', 'El cliente no tomó una decisión en el período esperado', true, 5),
(gen_random_uuid(), 'Cambio de prioridades', 'El cliente redirigió recursos a otras iniciativas', true, 6),
(gen_random_uuid(), 'Solución no se ajustó', 'Nuestra propuesta no respondía adecuadamente a las necesidades', true, 7),
(gen_random_uuid(), 'Falta de acceso a decisores', 'No logramos llegar a quienes toman la decisión real', true, 8),
(gen_random_uuid(), 'Timing incorrecto', 'El cliente no estaba en el momento adecuado para comprar', true, 9),
(gen_random_uuid(), 'Relación previa con competidor', 'El cliente tiene una relación de largo plazo con otro proveedor', true, 10),
(gen_random_uuid(), 'Otro', 'Razón no categorizada — ver detalle en notas', true, 11);
