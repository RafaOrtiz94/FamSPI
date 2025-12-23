# Business Case Implementation Tasks

## Visión general
Este documento sintetiza el `Plan de Modernización` completo y lo transforma en tareas concretas agrupadas por fases. Sirve como tablero visual para ejecutar la Fase 1 (infraestructura y servicios), la Fase 2 (wizard adaptable) y la Fase 3 (validación/documentación).

---

## Tarea 1 – Fase 1: Infraestructura y servicios base

**Objetivo:** habilitar las columnas, cálculos y APIs necesarias para soportar Business Cases públicos y privados con inversiones.

| Subtarea | Responsable | Estado | Referencia |
| --- | --- | --- | --- |
| Ejecutar migraciones 016-020 (`bc_purchase_type`, `bc_investments`, `annual_quantity`, ROI fields, `equipment quantity`) | Backend | ☐ | Ver `business-case-analysis-plan.md` – Fase 1 |
| Actualizar `businessCase.service.js` para guardar nuevos atributos y mantener compatibilidad con `v_business_cases_complete` | Backend | ☐ | `business-case-analysis-plan.md` (Fase 1) |
| Reescribir `businessCaseCalculator.service.js` (cálculos mensuales vs. anuales, `calculateComodatoRentability`, quantity del equipo) | Backend | ☐ | Plan sección "Fase 1" |
| Crear `investments.service.js`, controladores y rutas CRUD; actualizar exportadores PDF/XLS para inyectar métricas nuevas | Backend | ☐ | `business-case-analysis-plan.md` y rutas actuales |
| Agregar tests unitarios para calculadora (mensual, anual y ROI) y warnings específicos por tipo | QA | ☐ | Plan Fase 1 – Ver punto “Tests unitarios de cálculos” |

**Estimado:** 4-6 días (dependencias: migraciones + DB).

---

## Tarea 2 – Fase 2: Wizard adaptable y UX comercial

**Objetivo:** actualizar el flujo del wizard para cambiar pasos, labels y formularios según `bc_purchase_type` y `calculationMode`.

| Subtarea | Responsable | Estado | Referencia |
| --- | --- | --- | --- |
| Extender `BusinessCaseWizard.jsx` (nuevo estado `bcType`, pasos condicionales, `calculationMode`, `equipmentCost`) | Frontend | ☐ | `business-case-analysis-plan.md` Fase 2 |
| Modificar `Step1GeneralData.jsx` (selector tipo, campos duración/margen y metadata adicional) | Frontend | ☐ | Plan Fase 2 |
| Ajustar `Step2EquipmentSelector.jsx` para registrar `equipmentCost` y mantener la selección de equipo | Frontend | ☐ | Plan Fase 2 |
| Adaptar `Step3DeterminationSelector.jsx` al modo mensual/anual (envío de `monthly_quantity`/`annual_quantity`) | Frontend | ☐ | Plan Fase 2 |
| Crear `Step4RentabilitySummary.jsx` y mantener `Step4CalculationsSummary.jsx` para distintos tipos | Frontend | ☐ | Plan Fase 2 |
| Mejorar `Step5Investments.jsx` con selects de tipo/categoría y consumiendo la nueva API | Frontend | ☐ | Plan Fase 2 |
| Actualizar exportación PDF/Excel para mostrar ROI/margen cuando aplique | Backend/Frontend | ☐ | Plan Fase 2 y 1 |

**Estimado:** 4-5 días (previamente debe haber APIs y cálculos listos).

---

## Tarea 3 – Fase 3: Validación y despliegue

**Objetivo:** asegurar calidad, documentar las diferencias y monitorear el rollout.

| Subtarea | Responsable | Estado | Referencia |
| --- | --- | --- | --- |
| Ejecutar tests de integración (`npm test -- --grep "Business Case"`) y validar escenarios públicos/privados | QA | ☐ | Plan Fase 3 |
| Documentar cambios (`walkthrough.md`, guías, ejemplos ROI, diferencias de flujo) | Docs | ☐ | Plan Fase 3 |
| Pruebas manuales guiadas (escenarios de warnings y exportación) | QA/Product | ☐ | Plan Fase 3 |
| Capacitación/opcional rollout controlado y monitoreo (`warnings` en `bc_calculations`, logs de recalculaciones) | Operaciones | ☐ | Plan Fase 3 |

**Estimado:** 2-3 días (una vez estabilizados backend y frontend).

---

## Seguimiento

- Avanzar en orden: completar todas las subtareas de la Tarea 1 antes de iniciar la Tarea 2.  
- Registrar avances en esta tabla (usar checkboxes y responsables reales).  
- Antes de marcar cada fase como “completa”, verificar los tests y las pruebas manuales asociadas.
