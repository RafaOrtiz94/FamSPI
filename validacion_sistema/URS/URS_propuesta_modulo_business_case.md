# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Caso de Negocio

## 1. Introduccion
Este documento presenta la propuesta de requerimientos del modulo Caso de Negocio del Sistema de Procesos Internos SPI, elaborada mediante ingenieria inversa del codigo fuente vigente.

## 2. Objetivo del modulo
Definir y controlar las capacidades funcionales que el sistema debe ofrecer en el ambito de Caso de Negocio para soportar procesos internos del negocio.

## 3. Alcance funcional
- Gestion de capacidades de negocio implementadas en el modulo Caso de Negocio.
- Ejecucion de flujos CRUD/transaccionales soportados por rutas y servicios actuales.
- Consumo de componentes frontend vinculados y contratos API del backend.
- Aplicacion de controles de seguridad, validacion y trazabilidad detectados en el codigo.

## 4. Actores del sistema
- Acp Comercial
- Admin
- Administrador
- Backoffice Comercial
- Comercial
- Gerencia
- Gerencia General
- Jefe Comercial
- Jefe Operaciones
- Jefe Tecnico

## 5. Descripcion general del modulo
El modulo Caso de Negocio se implementa principalmente en backend/src/modules/business-case y se integra con la arquitectura API del sistema mediante rutas, controladores y servicios. Su comportamiento funcional actual se apoya en validaciones de entrada, control de permisos y trazabilidad operativa.

## 6. Funcionalidades identificadas
- Operacion API detectada: DELETE /:id.
- Operacion API detectada: DELETE /:id/determinations/:detId.
- Operacion API detectada: DELETE /:id/investments/:invId.
- Operacion API detectada: GET /.
- Operacion API detectada: GET /:id.
- Operacion API detectada: GET /:id/calculations.
- Operacion API detectada: GET /:id/complete.
- Operacion API detectada: GET /:id/consumption-items.
- Operacion API detectada: GET /:id/deliveries.
- Operacion API detectada: GET /:id/determinations.
- Operacion API detectada: GET /:id/determinations/stat-document.
- Operacion API detectada: GET /:id/dispatch-workspace.
- Operacion API detectada: GET /:id/equipment-details.
- Operacion API detectada: GET /:id/export/excel.
- Operacion API detectada: GET /:id/export/pdf.
- Operacion API detectada: GET /:id/investments.
- Operacion API detectada: GET /:id/investments/catalog.
- Operacion API detectada: GET /:id/lab-environment.
- Operacion API detectada: GET /:id/lis-integration.
- Operacion API detectada: GET /:id/lis-integration/equipment-interfaces.
- Operacion API detectada: GET /:id/orchestrator/complete.
- Operacion API detectada: GET /:id/ownership.
- Operacion API detectada: GET /:id/requirements.
- Operacion API detectada: GET /:id/sheets/jobs/:jobId.
- Operacion API detectada: GET /:id/sheets/jobs/latest.
- Operacion API detectada: GET /:id/sheets/preview.
- Operacion API detectada: GET /:id/ui-guidance.
- Operacion API detectada: GET /compatibility/statistics.
- Operacion API detectada: GET /equipment/:equipmentId/compatibility/backups.
- Operacion API detectada: GET /equipment/:primaryId/:backupId/compatibility/validate.
- [Funcionalidad detectada en el sistema] Persistencia/transaccion sobre tablas: an, bc_calculations, bc_consumption_excluded, bc_consumption_items, bc_deliveries, bc_determinations, bc_determinations_documents, bc_dispatch_items, bc_economic_data, bc_equipment_details, bc_equipment_selection, bc_investment_catalog, bc_investment_selections, bc_investments, bc_lab_environment, bc_lis_data, bc_lis_equipment_interfaces, bc_lis_integration, bc_master, bc_notification_legal_audit.

### Endpoints de API detectados
- DELETE /:id
- DELETE /:id/determinations/:detId
- DELETE /:id/investments/:invId
- GET /
- GET /:id
- GET /:id/calculations
- GET /:id/complete
- GET /:id/consumption-items
- GET /:id/deliveries
- GET /:id/determinations
- GET /:id/determinations/stat-document
- GET /:id/dispatch-workspace
- GET /:id/equipment-details
- GET /:id/export/excel
- GET /:id/export/pdf
- GET /:id/investments
- GET /:id/investments/catalog
- GET /:id/lab-environment
- GET /:id/lis-integration
- GET /:id/lis-integration/equipment-interfaces
- GET /:id/orchestrator/complete
- GET /:id/ownership
- GET /:id/requirements
- GET /:id/sheets/jobs/:jobId
- GET /:id/sheets/jobs/latest
- GET /:id/sheets/preview
- GET /:id/ui-guidance
- GET /compatibility/statistics
- GET /equipment/:equipmentId/compatibility/backups
- GET /equipment/:primaryId/:backupId/compatibility/validate

### Componentes del sistema
- backend\src\modules\business-case\__tests__\businessCaseDeterminationsGate.service.test.js
- backend\src\modules\business-case\__tests__\preflow.service.test.js
- backend\src\modules\business-case\bcDeliveries.service.js
- backend\src\modules\business-case\bcDispatchWorkspace.service.js
- backend\src\modules\business-case\bcEquipmentDetails.service.js
- backend\src\modules\business-case\bcLabEnvironment.service.js
- backend\src\modules\business-case\bcLisIntegration.service.js
- backend\src\modules\business-case\bcRequirements.service.js
- backend\src\modules\business-case\businessCase.controller.js
- backend\src\modules\business-case\businessCase.routes.js
- backend\src\modules\business-case\businessCase.service.js
- backend\src\modules\business-case\businessCaseCalculator.service.js
- backend\src\modules\business-case\businessCaseDeterminationsGate.service.js
- backend\src\modules\business-case\businessCaseDriveFolder.service.js
- backend\src\modules\business-case\businessCaseFeatureFlags.service.js
- backend\src\modules\business-case\businessCaseIdempotency.service.js
- backend\src\modules\business-case\businessCaseObservability.service.js
- backend\src\modules\business-case\BusinessCaseOrchestrator.service.js
- backend\src\modules\business-case\businessCasePreflow.service.js
- backend\src\modules\business-case\businessCaseSheetGeneration.controller.js
- backend\src\modules\business-case\businessCaseSheetGeneration.service.js
- backend\src\modules\business-case\businessCaseStateMachine.js
- backend\src\modules\business-case\calculationEngine.service.js
- backend\src\modules\business-case\calculationTemplates.controller.js
- backend\src\modules\business-case\determinations.service.js

### Componentes frontend relacionados
- spi_front\src\core\api\businessCaseApi.js

### Tablas/entidades de datos detectadas
- an
- bc_calculations
- bc_consumption_excluded
- bc_consumption_items
- bc_deliveries
- bc_determinations
- bc_determinations_documents
- bc_dispatch_items
- bc_economic_data
- bc_equipment_details
- bc_equipment_selection
- bc_investment_catalog
- bc_investment_selections
- bc_investments
- bc_lab_environment
- bc_lis_data
- bc_lis_equipment_interfaces
- bc_lis_integration
- bc_master
- bc_notification_legal_audit

## 7. Requerimientos funcionales de alto nivel
- REQ-BUCA-001: El sistema debe permitir consultar y listar informacion operativa del modulo Caso de Negocio segun los permisos del actor.
- REQ-BUCA-002: El sistema debe permitir ejecutar eliminaciones controladas del modulo Caso de Negocio cuando el flujo de negocio lo permita.
- REQ-BUCA-003: El sistema debe permitir gestionar evidencia documental asociada al modulo Caso de Negocio, incluyendo carga y consulta.
- REQ-BUCA-004: El sistema debe permitir generar salidas de control (reportes, resumenes o metricas) para seguimiento del modulo Caso de Negocio.
- REQ-BUCA-005: El sistema debe interoperar con integraciones externas del modulo Caso de Negocio: APIs HTTP externas, Correo corporativo, Eventos en tiempo real, Generacion documental PDF, Google OAuth/Drive.

## 8. Requerimientos no funcionales
- RNF-BUCA-001: El modulo debe aplicar control de acceso por autenticacion y autorizacion acorde a la sensibilidad del proceso.
- RNF-BUCA-002: El modulo debe mantener integridad de datos en operaciones de escritura, con manejo transaccional cuando aplique.
- RNF-BUCA-003: El modulo debe registrar trazabilidad/auditoria de acciones criticas para soporte de control interno.
- RNF-BUCA-004: El modulo debe gestionar errores de forma estandarizada, devolviendo codigos y mensajes tecnicos consumibles por frontend.
- RNF-BUCA-005: El modulo debe proteger datos sensibles en transito y en almacenamiento, segun politicas de seguridad del sistema.
- RNF-BUCA-006: El modulo debe sostener rendimiento operativo en consultas y operaciones frecuentes del proceso.
- RNF-BUCA-007: El modulo debe soportar disponibilidad operativa para jornadas internas y continuidad de procesos.
- RNF-BUCA-008: El modulo debe ser mantenible, con separacion clara de rutas, controladores y servicios en el codigo actual.

## 9. Reglas de negocio
- RN-BUCA-001: Solo los roles autorizados pueden ejecutar operaciones sensibles del modulo: acp_comercial, admin, administrador, backoffice_comercial, comercial, gerencia, gerencia_general, jefe_comercial, jefe_operaciones, jefe_tecnico.
- RN-BUCA-002: Las operaciones del modulo deben persistir informacion en las tablas asociadas manteniendo consistencia de datos.
- RN-BUCA-003: Las integraciones externas del modulo deben ejecutarse con tolerancia a fallos y trazabilidad de incidencias.
- RN-BUCA-004: [Funcionalidad detectada en el sistema] Se identifican reglas implicitas implementadas en servicios/controladores que deben formalizarse en el FRS.

## 10. Dependencias con otros modulos
- Notificaciones
- Pedidos de Compra Privada
- Pedidos de Compra Publica
- Integraciones externas detectadas: APIs HTTP externas, Correo corporativo, Eventos en tiempo real, Generacion documental PDF, Google OAuth/Drive.

