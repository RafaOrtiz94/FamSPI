# Business Case Modernization Analysis Plan

## Fase 1 – Infraestructura y servicios base (Backend + BD)

**Objetivo:** preparar la columna vertebral del Business Case dual antes de tocar la UI.

- Migraciones `016` a `020`: extender `equipment_purchase_requests` con `bc_purchase_type`, modo de cálculo, campos individuales de ROI y cantidad de equipo, crear la tabla `bc_investments` y agregar columnas a `bc_determinations`, `bc_calculations` y `bc_equipment_selection`.
- Extender `businessCase.service.js` para aceptar los nuevos campos (`bc_purchase_type`, `bc_duration_years`, `bc_equipment_cost`, etc.), ajustar `bc_stage` inicial según tipo, y seguir utilizando `v_business_cases_complete`.
- Reescribir `businessCaseCalculator.service.js` para distinguir cálculos mensuales vs anuales, leer la `quantity` del equipo y guardar `total_monthly/annual_*`. Inyectar `calculateComodatoRentability` que agrega inversión, ingresos, margen, ROI y payback (usa `bc_investments`).
- Crear `investments.service.js` y añadir rutas en `businessCase.routes.js` + controladores (get/post/put/delete) para poder llenar Step5; exportar datos en `pdfGenerator`/`excelExporter`.
- Agregar tests unitarios para la calculadora (caso público, caso privado con ROI y payback) y validar warnings específicos (`generatePublicWarnings`, `generateComodatoWarnings`).

## Fase 2 – Adaptación del Wizard y experiencia comercial (Frontend)

**Objetivo:** ofrecer una experiencia guiada que cambie según el tipo de BC y consuma los nuevos datos.

- Actualizar `BusinessCaseWizard.jsx` (estado, `bcType`, `calculationMode`, pasos dinámicos con `getStepsForType`, navegación condicional).
- Step1: selector de tipo y campos (duración, margen) que ajustan el modo de cálculo y alimentan `businessCase` (envían `bc_purchase_type` y metadatos extra).
- Step2: formulario igual pero con campo “Costo del equipo” visible para comodatos y guardado en el BC.
- Step3: inputs que cambian label/placeholder y POST según `calculationMode` (`monthly_quantity` vs `annual_quantity`), manteniendo el debounce y recalculado existente.
- Step4: separar en `Step4CalculationsSummary` (públicos) y `Step4RentabilitySummary` (privados) para mostrar métricas técnicas versus ROI/margen/payback; ambos consumen `GET /business-case/:id/calculations`.
- Step5: mejorar el formulario para seleccionar `investment_type` y `category`, consumir el nuevo API (`GET/POST/PUT/DELETE /business-case/:id/investments`), recalcular ROI al agregar inversiones.
- Final: mantiene `PUT /business-case/:id` para marcar completado y dispara exportaciones PDF/XLS que incluyan nuevos campos cuando se trata de un comodato.

## Fase 3 – Validación, documentación y despliegue

**Objetivo:** asegurarse de que el nuevo flujo cope con los escenarios públicos y privados antes de lanzarlo.

- Tests de integración (`npm test -- --grep "Business Case"`) que cubran creación, actualización de determinaciones y la nueva API de inversiones.
- Pruebas manuales guiadas: escenarios públicos, privados, warnings de ROI/capacidad y exportaciones (PDF/Excel).
- Documentación actualizada (`walkthrough.md`, guía de diferencias público vs privado, ejemplos de ROI y formato de exportación).
- Monitoreo post-despliegue: revisar `bc_calculations.warnings`, logs de recalculaciones fallidas y feedback de usuarios.
- Capacitación y despliegue controlado (rollout en ambientes, monitoreo de migraciones y scripts de rollback).

## Seguimiento

- Cada fase se divide en tickets semanales (migra/servicio/tests, luego UI, luego validación+docs).  
- Después de cada fase ejecutar pruebas automatizadas y revisión de QA antes de avanzar.  
- Mantener registros de cobertura en `bc_calculations` y `warnings jsonb` para detectar regresiones en cantidad o ROI.
