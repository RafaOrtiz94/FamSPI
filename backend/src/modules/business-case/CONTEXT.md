# CONTEXT.md — business-case

## 1. Descripción
Módulo de Business Case comercial. Gestiona la evaluación económica y operacional de propuestas de instalación de equipos para clientes. Incluye: catálogo de equipos, determinaciones, cálculos de ROI, generación de hojas de Excel/PDF, observabilidad, feature flags y orquestador de flujo unificado.

## 2. Endpoints (principales)

Prefijo: `/api/v1/business-case`

**CRUD principal:**
- **GET /api/v1/business-case/** — `list` — businessCaseRoles
- **POST /api/v1/business-case/** — `create` — requireRole(`comercial`)
- **GET /api/v1/business-case/:id** — `getById` — businessCaseRoles
- **PUT /api/v1/business-case/:id** — `update` — businessCaseRoles
- **DELETE /api/v1/business-case/:id** — requireRole(`gerencia`, `admin`)

**Determinaciones:**
- **GET /api/v1/business-case/:id/determinations** — `getDeterminations`
- **POST /api/v1/business-case/:id/determinations** — `addDetermination` (valida equipo + capacidad)
- **PUT /api/v1/business-case/:id/determinations/:detId** — `updateDetermination`
- **DELETE /api/v1/business-case/:id/determinations/:detId** — `removeDetermination`

**Cálculos y exportación:**
- **GET /api/v1/business-case/:id/calculations** — `getCalculations`
- **POST /api/v1/business-case/:id/recalculate** — `recalculate`
- **GET /api/v1/business-case/:id/export/pdf** — `exportPdf`
- **GET /api/v1/business-case/:id/export/excel** — `exportExcel`

**Hojas de cálculo:**
- **GET /api/v1/business-case/:id/sheets/preview** — `getSheetGenerationPreview`
- **POST /api/v1/business-case/:id/sheets/generate** — `enqueueSheetGeneration`
- **GET /api/v1/business-case/:id/sheets/jobs/latest** — `getLatestSheetGenerationJobStatus`

**Decisión de viabilidad:**
- **POST /api/v1/business-case/:id/feasibility-decision** — requireRole(`acp_comercial`, `jefe_comercial`, `gerencia`, `gerencia_general`)

**Orquestador:**
- **POST /api/v1/business-case/orchestrator/create-economic** — `createEconomicBC`
- **POST /api/v1/business-case/:id/orchestrator/calculate-roi** — `calculateROI`
- **POST /api/v1/business-case/:id/orchestrator/promote-stage** — `promoteStage`
- **POST /api/v1/business-case/:id/orchestrator/validate** — `validateBC`

**Inversiones y consumo:**
- **GET/POST /api/v1/business-case/:id/investments** — `getInvestments`/`addInvestment`
- **GET/PUT /api/v1/business-case/:id/consumption-items** — consumibles

**Observabilidad:**
- **GET /api/v1/business-case/observability/metrics** — roles privilegiados
- **GET /api/v1/business-case/observability/dashboard** — roles privilegiados

**Catálogos separados (sub-routers):**
- `/api/v1/equipment-catalog/` — catálogo de equipos
- `/api/v1/determinations-catalog/` — catálogo de determinaciones
- `/api/v1/calculation-templates/` — plantillas de cálculo

businessCaseRoles: `comercial`, `asesor_comercial`, `analista_comercial`, `acp_comercial`, `backoffice`, `backoffice_comercial`, `jefe_comercial`, `jefe_de_comercial`, `jefe_operaciones`, `jefe_tecnico`, `gerencia`, `gerencia_general`

## 3. Flujo principal

1. Comercial crea Business Case para un cliente
2. Se selecciona equipo del catálogo
3. Se agregan determinaciones (pruebas de laboratorio)
4. Sistema calcula ROI automáticamente
5. Se completan datos operacionales (entorno lab, LIS, requerimientos)
6. ACP o jefe toma decisión de viabilidad
7. Se genera hoja de cálculo en Google Sheets
8. Se exporta PDF/Excel para presentación

## 4. Validaciones
- `validateDeterminationEquipment`: valida compatibilidad determinación-equipo
- `validateEquipmentCapacity`: valida capacidad del equipo
- `businessCaseStateMachine.js` (12KB): estados del BC
- `businessCaseStateReadiness.js` (18KB): validación de completitud por estado
- `businessCasePermissions.js` (21KB): RBAC granular por sección
- `businessCaseDeterminationsGate.service.js` (11KB): gate para determinaciones

## 5. Base de datos
- `README_TABLE_STRUCTURE.md` existe en el módulo — documentación de tablas disponible
- No verificado en DB directamente

## 6. Relaciones
- `private-purchases`: BC puede iniciarse desde una compra privada
- `delivery-ceilings`: topes de entrega para BC
- `servicio`: equipos de BC referencian datos del servicio técnico
- `businessCaseDriveFolder.service.js`: integración con Google Drive
- `businessCaseSheetGeneration.service.js` (45KB): generación de hojas en Google Sheets

## 7. Frontend asociado
- `/dashboard/business-case` → `BusinessCaseWorkspace`
- `/dashboard/comercial/business-case` → `BusinessCaseWorkspace`
- `/dashboard/business-case/workspace/:id` → `BusinessCaseWorkspace`
- `/dashboard/business-case/observabilidad` → `BusinessCaseObservabilityDashboard`

## 8. Riesgos detectados
- `businessCase.controller.js` (115KB) — el controller más grande del sistema
- `businessCase.service.js` (47KB) — también muy grande
- `businessCaseSheetGeneration.service.js` (45KB) — dependencia fuerte con Google Sheets API
- `AGENTS.md` y `__tests__` presentes

## 9. Notas técnicas
- Módulo más complejo del sistema — 41 archivos
- Observabilidad incorporada con registro de métricas de API
- Feature flags para autosave configurables por admin
- `businessCaseIdempotency.service.js`: protección contra duplicados
