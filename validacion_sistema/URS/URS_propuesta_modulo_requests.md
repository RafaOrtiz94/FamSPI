# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Solicitudes

## 1. Introduccion
Este documento presenta la propuesta de requerimientos del modulo Solicitudes del Sistema de Procesos Internos SPI, elaborada mediante ingenieria inversa del codigo fuente vigente.

## 2. Objetivo del modulo
Definir y controlar las capacidades funcionales que el sistema debe ofrecer en el ambito de Solicitudes para soportar procesos internos del negocio.

## 3. Alcance funcional
- Gestion de capacidades de negocio implementadas en el modulo Solicitudes.
- Ejecucion de flujos CRUD/transaccionales soportados por rutas y servicios actuales.
- Consumo de componentes frontend vinculados y contratos API del backend.
- Aplicacion de controles de seguridad, validacion y trazabilidad detectados en el codigo.

## 4. Actores del sistema
- Acp Comercial
- Backoffice Comercial
- Calidad
- Comercial
- Finanzas
- Gerencia
- Jefe Calidad
- Jefe Comercial
- Jefe Operaciones
- Jefe Servicio Tecnico

## 5. Descripcion general del modulo
El modulo Solicitudes se implementa principalmente en backend/src/modules/requests y se integra con la arquitectura API del sistema mediante rutas, controladores y servicios. Su comportamiento funcional actual se apoya en validaciones de entrada, control de permisos y trazabilidad operativa.

## 6. Funcionalidades identificadas
- Operacion API detectada: GET /.
- Operacion API detectada: GET /:id.
- Operacion API detectada: GET /new-client.
- Operacion API detectada: GET /new-client/:id.
- Operacion API detectada: GET /new-client/my.
- Operacion API detectada: GET /new-client/summary.
- Operacion API detectada: GET /public/consent/:token.
- Operacion API detectada: POST /.
- Operacion API detectada: POST /:id/cancel.
- Operacion API detectada: POST /new-client.
- Operacion API detectada: POST /new-client/consent-token.
- Operacion API detectada: POST /new-client/consent-token/verify.
- Operacion API detectada: PUT /:id/resubmit.
- Operacion API detectada: PUT /new-client/:id.
- Operacion API detectada: PUT /new-client/:id/process.
- Operacion API detectada: PUT /new-client/:id/quality-checklist.
- [Funcionalidad detectada en el sistema] Persistencia/transaccion sobre tablas: client_assignments, client_request_consent_tokens, client_request_consents, client_request_quality_checks, client_requests, departments, equipment_purchase_requests, legacy, pg_constraint, provider, public.equipos_historial, public.equipos_modelo, public.equipos_unidad, request_attachments, request_types, request_versions, requests, signed, users, v2.

### Endpoints de API detectados
- GET /
- GET /:id
- GET /new-client
- GET /new-client/:id
- GET /new-client/my
- GET /new-client/summary
- GET /public/consent/:token
- POST /
- POST /:id/cancel
- POST /new-client
- POST /new-client/consent-token
- POST /new-client/consent-token/verify
- PUT /:id/resubmit
- PUT /new-client/:id
- PUT /new-client/:id/process
- PUT /new-client/:id/quality-checklist

### Componentes del sistema
- backend\src\modules\requests\purchaseRequestsFacade.js
- backend\src\modules\requests\requests.controller.js
- backend\src\modules\requests\requests.routes.js
- backend\src\modules\requests\requests.service.js
- backend\src\modules\requests\requestSchemas.js

### Componentes frontend relacionados
- spi_front\src\core\api\requestsApi.js

### Tablas/entidades de datos detectadas
- client_assignments
- client_request_consent_tokens
- client_request_consents
- client_request_quality_checks
- client_requests
- departments
- equipment_purchase_requests
- legacy
- pg_constraint
- provider
- public.equipos_historial
- public.equipos_modelo
- public.equipos_unidad
- request_attachments
- request_types
- request_versions
- requests
- signed
- users
- v2

## 7. Requerimientos funcionales de alto nivel
- REQ-REQU-001: El sistema debe permitir consultar y listar informacion operativa del modulo Solicitudes segun los permisos del actor.
- REQ-REQU-002: El sistema debe permitir registrar nuevas operaciones/transacciones del modulo Solicitudes con validaciones de entrada.
- REQ-REQU-003: El sistema debe permitir actualizar datos y estados del modulo Solicitudes preservando trazabilidad.
- REQ-REQU-004: El sistema debe controlar cambios de estado/aprobacion del proceso en Solicitudes segun reglas y roles definidos.
- REQ-REQU-005: El sistema debe permitir generar salidas de control (reportes, resumenes o metricas) para seguimiento del modulo Solicitudes.
- REQ-REQU-006: El sistema debe interoperar con integraciones externas del modulo Solicitudes: Calendario, Correo corporativo, Eventos en tiempo real, Generacion documental PDF, Google OAuth/Drive.

## 8. Requerimientos no funcionales
- RNF-REQU-001: El modulo debe aplicar control de acceso por autenticacion y autorizacion acorde a la sensibilidad del proceso.
- RNF-REQU-002: El modulo debe mantener integridad de datos en operaciones de escritura, con manejo transaccional cuando aplique.
- RNF-REQU-003: El modulo debe registrar trazabilidad/auditoria de acciones criticas para soporte de control interno.
- RNF-REQU-004: El modulo debe gestionar errores de forma estandarizada, devolviendo codigos y mensajes tecnicos consumibles por frontend.
- RNF-REQU-005: El modulo debe proteger datos sensibles en transito y en almacenamiento, segun politicas de seguridad del sistema.
- RNF-REQU-006: El modulo debe sostener rendimiento operativo en consultas y operaciones frecuentes del proceso.
- RNF-REQU-007: El modulo debe soportar disponibilidad operativa para jornadas internas y continuidad de procesos.
- RNF-REQU-008: El modulo debe ser mantenible, con separacion clara de rutas, controladores y servicios en el codigo actual.

## 9. Reglas de negocio
- RN-REQU-001: Solo los roles autorizados pueden ejecutar operaciones sensibles del modulo: acp_comercial, backoffice_comercial, calidad, comercial, finanzas, gerencia, jefe_calidad, jefe_comercial, jefe_operaciones, jefe_servicio_tecnico, jefe_talento_humano, jefe_tecnico, jefe_ti, operaciones, talento_humano, tecnico, ti.
- RN-REQU-002: Los cambios de estado deben respetar la secuencia de negocio definida por la logica actual del modulo.
- RN-REQU-003: Las operaciones del modulo deben persistir informacion en las tablas asociadas manteniendo consistencia de datos.
- RN-REQU-004: Las integraciones externas del modulo deben ejecutarse con tolerancia a fallos y trazabilidad de incidencias.
- RN-REQU-005: [Funcionalidad detectada en el sistema] Se identifican reglas implicitas implementadas en servicios/controladores que deben formalizarse en el FRS.

## 10. Dependencias con otros modulos
- Inventario
- Notificaciones
- Pedidos de Compra Publica
- Integraciones externas detectadas: Calendario, Correo corporativo, Eventos en tiempo real, Generacion documental PDF, Google OAuth/Drive.

