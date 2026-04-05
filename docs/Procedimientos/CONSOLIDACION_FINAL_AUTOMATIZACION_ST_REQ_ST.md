# Consolidacion Final Automatizacion ST (REQ-ST-*)

Fecha de consolidacion: 2026-04-04

## 1) Cierre tecnico aplicado en esta iteracion

### Unificacion frontend (visual y UX)

- Base de componentes reforzada:
  - `spi_front/src/core/ui/components/Card.jsx` (radio unificado a `rounded-2xl`)
  - `spi_front/src/core/ui/components/Button.jsx` (formas consistentes en `sm/md/lg`)
- Extraccion de utilidades compartidas:
  - `spi_front/src/core/utils/workflowUi.js`
  - Funciones: normalizacion de fecha, formato fecha/hora, label de estado, badge por estado, duracion en minutos.
- Refactor de vistas para usar utilidades compartidas y botones/cards coherentes:
  - `spi_front/src/modules/comercial/components/EquipmentPurchaseWidget.jsx`
  - `spi_front/src/modules/servicio/pages/TechnicalProcedureWorkspace.jsx`
  - `spi_front/src/modules/servicio/pages/Mantenimientos.jsx`
  - `spi_front/src/modules/ti/pages/TicketsWorkspace.jsx`
  - `spi_front/src/modules/servicio/pages/ExternalCasesWorkspace.jsx`
  - `spi_front/src/modules/servicio/components/WorkflowTimeline.jsx`
  - `spi_front/src/modules/servicio/components/CorrectiveCaseTimeline.jsx`

### APIs/rutas consolidadas

- Cliente API agregado para integraciones:
  - `spi_front/src/core/api/integrationsApi.js`
  - Export en `spi_front/src/core/api/indexExports.js`
- API de resumen operativo ST (foco REQ-ST-152):
  - Backend: `GET /api/v1/servicio/workflow/reporting-summary`
  - Archivos:
    - `backend/src/modules/servicio/servicio.routes.js`
    - `backend/src/modules/servicio/servicio.controller.js`
  - Cliente frontend:
    - `spi_front/src/core/api/servicioApi.js` (`getWorkflowReportingSummary`)
- Trazabilidad documental reforzada (foco REQ-ST-151):
  - `backend/src/modules/servicio/servicio.controller.js`
  - `trackWorkflowDocument` ahora persiste metadatos de:
    - emision (`emitted_at`, actor)
    - origen (`source_type`, `source_id`, `request_id`, `procedure_code`, `stage_key`)
    - template (`mode`, `version`, compatibilidad)
    - drive (`file_id`, `folder_id`)
    - hash/integridad asinc (`metadata.integrity`)

## 2) Pruebas ejecutadas

### Backend smoke por flujo

- Validacion sintactica (`node -c`) de rutas/controladores ST e integraciones: PASS.
- Smoke de rutas clave por flujo (script de presencia de endpoints):
  - ST-01-01 publico: PASS
  - ST-01-01 privado: PASS
  - ST-01-02 preventivo: PASS
  - ST-01-03 correctivo: PASS
  - ST-01-04 externo: PASS
- Smoke de integraciones externas (adapters):
  - Navify/ReXIS bloqueados por contrato: PASS (error funcional controlado)
  - GoApp mock health/sync: PASS
- Prueba de transiciones invalidas (correctivos):
  - `closed -> visit_in_progress` rechazada con `CORRECTIVE_CASE_INVALID_TRANSITION`: PASS

### Frontend smoke por ruta principal

- Verificacion de rutas registradas en `AppRoutes.jsx` (script):
  - `/dashboard/servicio-tecnico/workspace-procedimiento`: PASS
  - `/dashboard/servicio-tecnico/mantenimientos`: PASS
  - `/dashboard/ti/workspace`: PASS
  - `/dashboard/servicio-tecnico/casos-externos`: PASS
  - `/dashboard/ti/casos-externos`: PASS
- Lint focalizado en archivos consolidados: PASS sin errores (solo warnings preexistentes fuera de esta consolidacion o legacy en `EquipmentPurchaseWidget`).

### Prueba documental de emision

- Smoke de trazabilidad documental (script estatico):
  - persistencia `metadata.integrity` (hash): PASS
  - evento de auditoria `document_generated`: PASS
  - endpoint resumen documental `/workflow-documents/summary`: PASS
  - endpoint timeline `/workflow/timeline`: PASS

## 3) Matriz final de trazabilidad (REQ-ST -> archivo/endpoint/pantalla)

Estado usado:
- `Implementado`: logica + persistencia + endpoint + pantalla/cliente operable.
- `Parcial`: cobertura funcional relevante, pero faltan piezas para operacion total del procedimiento.
- `Bloqueado externo`: depende de contrato/template/credencial no entregado.
- `No evidenciado`: no hay implementacion verificable suficiente.

| REQ-ST | Backend (archivo/endpoint) | Frontend (pantalla/api) | Estado |
|---|---|---|---|
| 001-010 | `servicio/workflowRegistry.service.js`, `servicio/workflowAudit.service.js`, `servicio.routes.js` (`/workflow/registry`, `/workflow/timeline`) | `TechnicalProcedureWorkspace`, `WorkflowTimeline`, `servicioApi` | Parcial |
| 011-022 | `business-case/*`, `equipmentPurchases.service.js` (coordinacion) | `BusinessCaseWorkspace`, `EquipmentPurchaseWidget` | Parcial |
| 023-036 | `equipment-purchases` + `private-purchases` inspeccion/coordinacion/sitio | `TechnicalProcedureWorkspace`, `EquipmentPurchaseWidget`, `privatePurchasesApi` | Parcial |
| 037-053 | `installationWorkflow.service.js`, `privatePurchases.service.js`, `equipmentPurchases.service.js` | `PrivatePurchaseDeliveries`, `TechnicalProcedureWorkspace` | Parcial |
| 054-069 | `trainingWorkflow.service.js`, endpoints entrenamiento/F.ST-04/F.ST-05/F.ST-12 | `Aplicaciones`, `TrainingWorkflowWorkspace`, steppers entrenamiento | Parcial |
| 070-080 | `withdrawalWorkflow.service.js`, `fst11.service.js`, retiro/desinfeccion | `RetiroEquipos`, `WithdrawalStepper`, `DesinfeccionStepper` | Parcial |
| 081-100 | `preventivePlanning.service.js`, `mantenimientos.routes.js` (`/preventive/*`) | `Mantenimientos`, `PreventiveAnnualPlanBoard`, `PreventiveEquipmentSchedulePanel`, `mantenimientosApi` | Parcial |
| 101-119 | `correctiveCases.service.js`, `correctiveStateMachine.service.js`, `servicio.routes.js` (`/corrective-cases/*`) | `CorrectiveCaseWorkspace`, `CorrectiveCaseTimeline`, `servicioApi` | Parcial |
| 120-137 | `externalCases.service.js`, adapters (`navify/rexis/goapp`), `/servicio/external-cases/*`, `/integrations/*` | `ExternalCasesWorkspace`, `ExternalIntegrationHealthPanel`, `externalCasesApi`, `integrationsApi` | Parcial (con stubs contract-safe) |
| 138-146 | `documentTemplateRegistry.service.js`, `documentCompatibility.service.js`, `servicio.routes.js` (`/workflow/catalog`) | `servicioApi` (`getWorkflowCatalog`) | Parcial |
| 147 | compatibilidad F.ST-09 en servicios/document gate | flujos de verificacion ST | Pendiente/Parcial |
| 148 | compatibilidad campo `ANÁLISIS/ANALISIS` con gate documental | flujos de verificacion ST | Pendiente/Parcial |
| 149 | trazabilidad F.ST-05 + estrategia de overflow en asistencia | `AsistenciaStepper` | Pendiente/Parcial |
| 150 | normalizacion checks F.ST-02 (CVTE/DFD_op) | `DesinfeccionStepper` | Pendiente/Parcial |
| 151 | `servicio.controller.js` (track + metadata + hash `metadata.integrity`), `workflow_documents` | `WorkflowDocumentsPanel`, `TechnicalProcedureWorkspace`, `servicioApi` (`listWorkflowDocuments*`) | Parcial alto |
| 152 | `servicio.controller.js` (`/workflow/reporting-summary`), KPIs en `mantenimientos`, `corrective`, `external-cases` | `Mantenimientos`, `CorrectiveCaseWorkspace`, `ExternalCasesWorkspace`, `servicioApi` (`getWorkflowReportingSummary`) | Parcial alto |

## 4) Pendientes reales (sin cierres falsos)

### Templates no aprobados

- Siguen pendientes templates/campos oficiales para automatizacion completa de:
  - `F.ST-07`, `F.ST-11`, `F.ST-12`, `F.ST-14`, `F.ST-16`, `F.ST-17`, `F.ST-18`, `F.ST-19`, `F.ST-21`
- Mientras no exista contrato formal de campos firmado, no se marca cobertura total documental.

### Contratos externos faltantes

- Ver detalle en:
  - `docs/Procedimientos/ST-01-04_EXTERNAL_CONTRACT_GAPS.md`
- Faltan contratos oficiales de payload/autenticacion/estados para Navify, Online Support y REXIS.
- GoApp esta operativo en capa interna con `mock/stub` y control de feature flags, no con contrato productivo final confirmado.

### Credenciales de terceros no entregadas

- Credenciales productivas de proveedores externos no evidenciadas en entorno de prueba.
- Sin esas credenciales no se puede certificar sincronizacion E2E real fuera de modo controlado.

## 5) Criterio de cierre aplicado

Ningun `REQ-ST` se marca como `Implementado` si solo existe placeholder cosmetico.  
El estado reportado en esta matriz se basa en evidencia de logica, persistencia, endpoint y consumo operativo en pantalla/API.
