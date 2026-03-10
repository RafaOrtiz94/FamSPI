# DOCUMENTO DE DISENO DEL SISTEMA (DS)

## Nombre del modulo
Business Case

## Arquitectura del modulo
- Capa de presentacion: frontend React o consumidores internos del SPI.
- Capa API: rutas Express bajo prefijos del backend.
- Capa de negocio: controladores y servicios del modulo.
- Capa de persistencia: consultas SQL directas y tablas asociadas.
- Capa transversal: autenticacion, autorizacion, auditoria y notificaciones cuando aplica.

## Componentes del sistema
### Controladores
- `backend/src/modules/business-case/businessCase.controller.js`
- `backend/src/modules/business-case/equipmentCatalog.controller.js`
- `backend/src/modules/business-case/determinationsCatalog.controller.js`
- `backend/src/modules/business-case/calculationTemplates.controller.js`
- `backend/src/modules/business-case/businessCaseSheetGeneration.controller.js`

### Servicios
- `backend/src/modules/business-case/businessCase.service.js`
- `backend/src/modules/business-case/businessCaseStateMachine.js`
- `backend/src/modules/business-case/businessCasePreflow.service.js`
- `backend/src/modules/business-case/businessCaseDeterminationsGate.service.js`
- `backend/src/modules/business-case/investments.service.js`
- `backend/src/modules/business-case/calculationEngine.service.js`
- `backend/src/modules/business-case/businessCaseSheetGeneration.service.js`
- `backend/src/jobs/businessCaseSheetGenerationQueueScheduler.js`

### Modelos
- Sin ORM; SQL directo, reglas de estado y servicios por seccion.

### Rutas
- `backend/src/modules/business-case/businessCase.routes.js`
- Montajes derivados:
- `/api/v1/business-case`
- `/api/v1/equipment-catalog`
- `/api/v1/determinations-catalog`
- `/api/v1/calculation-templates`

### Componentes de interfaz
- `spi_front/src/modules/comercial/pages/BusinessCaseWorkspace.jsx`
- `spi_front/src/modules/comercial/pages/BusinessCaseObservabilityDashboard.jsx`
- `spi_front/src/modules/comercial/components/workspace/WorkspaceContent.jsx`
- `spi_front/src/modules/comercial/components/workspace/SectionContent.jsx`
- `spi_front/src/modules/comercial/components/workspace/sections/*.jsx`
- `spi_front/src/core/api/businessCaseApi.js`

## Modelo de datos asociado
- `bc_master`
- `bc_economic_data`
- `bc_operational_data`
- `bc_determinations`
- `bc_equipment_selection`
- `bc_investments`
- `bc_investment_catalog`
- `bc_investment_selections`
- `bc_consumption_items`
- `bc_consumption_excluded`
- `bc_dispatch_items`
- `bc_requirements`
- `bc_deliveries`
- `business_case_state_transitions`
- `business_case_section_ownership`
- `business_case_section_ownership_audit`
- `business_case_feature_flags`
- `business_case_idempotency_keys`
- `bc_sheet_generation_jobs`
- `equipment_purchase_business_case_links`

## Interfaces API
### Core business case
- `GET /api/v1/business-case`
- `POST /api/v1/business-case`
- `GET /api/v1/business-case/:id`
- `PUT /api/v1/business-case/:id`
- `DELETE /api/v1/business-case/:id`
- `POST /api/v1/business-case/:id/equipment`
- `GET /api/v1/business-case/:id/determinations`
- `POST /api/v1/business-case/:id/determinations`
- `PUT /api/v1/business-case/:id/determinations/:detId`
- `DELETE /api/v1/business-case/:id/determinations/:detId`
- `GET /api/v1/business-case/:id/calculations`
- `POST /api/v1/business-case/:id/recalculate`
- `GET /api/v1/business-case/:id/export/pdf`
- `GET /api/v1/business-case/:id/export/excel`
- `POST /api/v1/business-case/:id/feasibility-decision`

### Workspace, ownership y observabilidad
- `GET /api/v1/business-case/:id/ui-guidance`
- `GET /api/v1/business-case/:id/ownership`
- `POST /api/v1/business-case/:id/ownership/complete`
- `POST /api/v1/business-case/:id/sections/:section/lock`
- `POST /api/v1/business-case/:id/sections/:section/unlock`
- `POST /api/v1/business-case/observability/frontend-events`
- `GET /api/v1/business-case/observability/metrics`
- `GET /api/v1/business-case/observability/dashboard`
- `GET /api/v1/business-case/feature-flags/autosave`
- `PUT /api/v1/business-case/feature-flags/autosave`

### Inversiones, consumo y despacho
- `GET /api/v1/business-case/:id/investments`
- `POST /api/v1/business-case/:id/investments`
- `PUT /api/v1/business-case/:id/investments/:invId`
- `DELETE /api/v1/business-case/:id/investments/:invId`
- `GET /api/v1/business-case/:id/investments/catalog`
- `POST /api/v1/business-case/:id/investments/catalog`
- `POST /api/v1/business-case/:id/investments/selections`
- `GET /api/v1/business-case/:id/consumption-items`
- `PUT /api/v1/business-case/:id/consumption-items`
- `GET /api/v1/business-case/:id/dispatch-workspace`
- `PUT /api/v1/business-case/:id/dispatch-workspace/commercial-plan`
- `PUT /api/v1/business-case/:id/dispatch-workspace/operations-control`

### Hojas BC y jobs
- `GET /api/v1/business-case/:id/sheets/preview`
- `POST /api/v1/business-case/:id/sheets/generate`
- `GET /api/v1/business-case/:id/sheets/jobs/latest`
- `GET /api/v1/business-case/:id/sheets/jobs/:jobId`
- `GET /api/v1/business-case/sheets/metrics`
- `POST /internal/jobs/business-case/sheets/process-queue`
- `POST /internal/jobs/business-case/preflow/expiry`
- `POST /internal/jobs/business-case/determinations-gate/expiry`

### Catalogos
- `GET /api/v1/equipment-catalog`
- `GET /api/v1/equipment-catalog/:id`
- `POST /api/v1/equipment-catalog`
- `PUT /api/v1/equipment-catalog/:id`
- `GET /api/v1/determinations-catalog`
- `POST /api/v1/determinations-catalog`
- `PUT /api/v1/determinations-catalog/:id`
- `DELETE /api/v1/determinations-catalog/:id`
- `GET /api/v1/calculation-templates`
- `POST /api/v1/calculation-templates`
- `PUT /api/v1/calculation-templates/:id`
- `DELETE /api/v1/calculation-templates/:id`

## Dependencias tecnicas
- Comercial y Gestion de Clientes.
- Inventario y Equipos.
- Notificaciones y Comunicaciones.
- Reportes y Auditoria.
- Servicio Tecnico y Mantenimientos.

## Controles de seguridad y operacion
### Control de acceso
- JWT obligatorio y `requireRole` por endpoint de seccion/accion.
- Operaciones administrativas restringidas a roles de gerencia/admin.

### Autenticacion
- Usuario autenticado requerido para todo el modulo.

### Autorizacion
- ACL por rol y por etapa del workflow.
- Mecanismos de ownership y lock de secciones para evitar edicion indebida.

### Registro de auditoria
- Registro de transiciones de estado y ownership.
- Trazabilidad de jobs de generacion de hojas y eventos de observabilidad.

### Proteccion de datos
- Validaciones de compatibilidad de equipo y determinaciones.
- Manejo de concurrencia/idempotencia en operaciones sensibles.

## Riesgos tecnicos detectados
- Alta complejidad de estados y permisos por seccion.
- Dependencia de jobs asincronos para entrega de artefactos BC.
- Riesgo de dualidad de datos entre metadata legacy y estructura canonica.
- Carga de calculos intensivos y reportes puede impactar rendimiento.

## Diagrama tecnico
`mermaid
flowchart LR
  UI[Frontend o consumidor] --> API[API BC]
  API --> CTRL[Controladores]
  CTRL --> SVC[Servicios]
  SVC --> DB[(Base de datos)]
  SVC --> EXT[Dependencias externas o modulos transversales]
`
