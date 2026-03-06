# INFORME DE VALIDACION DEL MODULO

## Nombre del modulo
Business Case Comercial

## Descripcion del modulo
Gestiona la evaluacion tecnico-economica de oportunidades comerciales, con secciones colaborativas por rol, calculos de rentabilidad, control de workflow por estados y exportacion de resultados para decision gerencial.

## Alcance funcional
- Alta, consulta, edicion y cierre de business cases.
- Seleccion de equipamiento y determinaciones.
- Calculos economicos, ROI y decision de factibilidad.
- Gestion de inversiones, consumo y plan de despacho.
- Control de ownership por seccion y bloqueo/desbloqueo.
- Integracion con catalogos de equipos/determinaciones/plantillas.
- Observabilidad del workspace y feature flags de autosave.
- Cola de generacion de hojas BC y seguimiento de jobs.

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

## Endpoints de API
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

## Tablas de base de datos asociadas
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

## Dependencias con otros modulos
- Comercial y Gestion de Clientes.
- Inventario y Equipos.
- Notificaciones y Comunicaciones.
- Reportes y Auditoria.
- Servicio Tecnico y Mantenimientos.

## Controles de seguridad
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

## Riesgos operativos
- Alta complejidad de estados y permisos por seccion.
- Dependencia de jobs asincronos para entrega de artefactos BC.
- Riesgo de dualidad de datos entre metadata legacy y estructura canonica.
- Carga de calculos intensivos y reportes puede impactar rendimiento.

## Posibles escenarios de falla
- Lock de seccion no liberado por fallo en flujo de usuario.
- Job de hoja BC en estado `failed` sin reproceso oportuno.
- Desfase entre estado de BC y proceso de compra asociado.
- Formula de catalogo invalida afectando calculo de rentabilidad.

## Nivel de criticidad
ALTO

## Prioridad de validacion
ALTA

---

## BASE DOCUMENTAL PARA VALIDACION

## Requerimientos del usuario (URS)
- `URS-BC-001`: El sistema debe permitir construir business cases por etapas y roles.
- `URS-BC-002`: El sistema debe calcular rentabilidad y soportar decision de factibilidad.
- `URS-BC-003`: El sistema debe gestionar inversiones, consumos y plan de despacho.
- `URS-BC-004`: El sistema debe controlar ownership y bloqueo de secciones por responsabilidad.
- `URS-BC-005`: El sistema debe generar y monitorear artefactos de salida (hojas/reportes BC).

## Requerimientos funcionales
- `RF-BC-001`: CRUD de business case con persistencia canonica de secciones.
- `RF-BC-002`: Gestionar determinaciones/equipamiento con validaciones de consistencia.
- `RF-BC-003`: Ejecutar calculos y exportes PDF/Excel por demanda.
- `RF-BC-004`: Registrar estado, transiciones y ownership de trabajo colaborativo.
- `RF-BC-005`: Encolar y procesar generacion de hojas BC con control de estado de job.

## Resumen del diseno tecnico
- Modulo compuesto por servicios especializados por dominio BC.
- Motor de workflow con state machine y restricciones por rol.
- Jobs asincronos para tareas pesadas (sheet generation/expiraciones).
- Frontend workspace modular con paneles por seccion y observabilidad.

## Escenarios de prueba
### Funcionalidad
- Caso: Crear BC, seleccionar equipos y registrar determinaciones.
- Resultado esperado: Persistencia integral de secciones y calculos disponibles.

### Seguridad
- Caso: Usuario sin rol autorizado intenta desbloquear seccion.
- Resultado esperado: `403` y seccion permanece bloqueada.

### Manejo de errores
- Caso: Formula invalida en determinacion de catalogo.
- Resultado esperado: rechazo de actualizacion y mensaje de validacion.

### Integridad de datos
- Caso: Generar hoja BC en cola y consultar estado final del job.
- Resultado esperado: job trazable en `bc_sheet_generation_jobs` y metadata del BC actualizada.

---

## MATRIZ DE TRAZABILIDAD

| Requerimiento | Componente | Prueba |
|---|---|---|
| REQ-BC-001 Workflow por etapas | `businessCase.service` + `businessCaseStateMachine` | Crear BC y promover etapas validas |
| REQ-BC-002 Calculo de factibilidad | `calculationEngine.service` + `submitFeasibilityDecision` | Ejecutar recalculo y registrar decision |
| REQ-BC-003 Inversion/consumo/despacho | `investments.service` + `bcDispatchWorkspace.service` | Guardar plan y validar resumen de datos |
| REQ-BC-004 Ownership y bloqueos | `businessCaseDataOwnership` + rutas lock/unlock | Bloquear/desbloquear y auditar responsables |
| REQ-BC-005 Cola de hojas BC | `businessCaseSheetGeneration.service` | Encolar, procesar y verificar estado final de job |
