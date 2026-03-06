# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Pedidos de Compra Privada

## 1. Introduccion
Este documento presenta la propuesta de requerimientos del modulo Pedidos de Compra Privada del Sistema de Procesos Internos SPI, elaborada mediante ingenieria inversa del codigo fuente vigente.

## 2. Objetivo del modulo
Definir y controlar las capacidades funcionales que el sistema debe ofrecer en el ambito de Pedidos de Compra Privada para soportar procesos internos del negocio.

## 3. Alcance funcional
- Gestion de capacidades de negocio implementadas en el modulo Pedidos de Compra Privada.
- Ejecucion de flujos CRUD/transaccionales soportados por rutas y servicios actuales.
- Consumo de componentes frontend vinculados y contratos API del backend.
- Aplicacion de controles de seguridad, validacion y trazabilidad detectados en el codigo.

## 4. Actores del sistema
- Acp Comercial
- Backoffice Comercial
- Jefe Comercial
- Jefe Servicio Tecnico
- Jefe Tecnico
- Servicios/integraciones externas del modulo
- Usuario autenticado del proceso interno

## 5. Descripcion general del modulo
El modulo Pedidos de Compra Privada se implementa principalmente en backend/src/modules/private-purchases y se integra con la arquitectura API del sistema mediante rutas, controladores y servicios. Su comportamiento funcional actual se apoya en validaciones de entrada, control de permisos y trazabilidad operativa.

## 6. Funcionalidades identificadas
- Operacion API detectada: GET /.
- Operacion API detectada: GET /:id.
- Operacion API detectada: GET /:id/check-client-approval.
- Operacion API detectada: GET /:id/documents.
- Operacion API detectada: GET /:id/timeline.
- Operacion API detectada: GET /:id/transitions.
- Operacion API detectada: GET /by-role/:role.
- Operacion API detectada: GET /events.
- Operacion API detectada: GET /mine.
- Operacion API detectada: GET /stats/:role.
- Operacion API detectada: PATCH /:id/coordinate-inspection-date.
- Operacion API detectada: PATCH /:id/review-inspection-date.
- Operacion API detectada: POST /.
- Operacion API detectada: POST /:id/cancel.
- Operacion API detectada: POST /:id/complete-delivery.
- Operacion API detectada: POST /:id/contract/client-signed.
- Operacion API detectada: POST /:id/delivery-act.
- Operacion API detectada: POST /:id/delivery-act/assign.
- Operacion API detectada: POST /:id/delivery-act/finalize.
- Operacion API detectada: POST /:id/delivery-guides.
- Operacion API detectada: POST /:id/dispatch-details.
- Operacion API detectada: POST /:id/inspection-request.
- Operacion API detectada: POST /:id/mark-equipment-arrived.
- Operacion API detectada: POST /:id/offer.
- Operacion API detectada: POST /:id/offer/signed.
- Operacion API detectada: POST /:id/operations-details.
- Operacion API detectada: POST /:id/provider-response.
- Operacion API detectada: POST /:id/ready-for-delivery.
- Operacion API detectada: POST /:id/register-client.
- Operacion API detectada: POST /:id/request-client-registration.
- [Funcionalidad detectada en el sistema] Persistencia/transaccion sobre tablas: client_requests, equipment_purchase_requests, private_purchase_requests, private_purchase_state_transitions, request_types, requests, servicio.cronograma_actividades_tecnicas, servicio.cronograma_capacitacion, servicio.cronograma_mantenimientos, servicio.cronograma_mantenimientos_anuales, users.

### Endpoints de API detectados
- GET /
- GET /:id
- GET /:id/check-client-approval
- GET /:id/documents
- GET /:id/timeline
- GET /:id/transitions
- GET /by-role/:role
- GET /events
- GET /mine
- GET /stats/:role
- PATCH /:id/coordinate-inspection-date
- PATCH /:id/review-inspection-date
- POST /
- POST /:id/cancel
- POST /:id/complete-delivery
- POST /:id/contract/client-signed
- POST /:id/delivery-act
- POST /:id/delivery-act/assign
- POST /:id/delivery-act/finalize
- POST /:id/delivery-guides
- POST /:id/dispatch-details
- POST /:id/inspection-request
- POST /:id/mark-equipment-arrived
- POST /:id/offer
- POST /:id/offer/signed
- POST /:id/operations-details
- POST /:id/provider-response
- POST /:id/ready-for-delivery
- POST /:id/register-client
- POST /:id/request-client-registration

### Componentes del sistema
- backend\src\modules\private-purchases\privatePurchases.controller.js
- backend\src\modules\private-purchases\privatePurchases.routes.js
- backend\src\modules\private-purchases\privatePurchases.service.js
- backend\src\modules\private-purchases\privatePurchaseStateMachine.js

### Componentes frontend relacionados
- spi_front\src\core\api\privatePurchasesApi.js

### Tablas/entidades de datos detectadas
- client_requests
- equipment_purchase_requests
- private_purchase_requests
- private_purchase_state_transitions
- request_types
- requests
- servicio.cronograma_actividades_tecnicas
- servicio.cronograma_capacitacion
- servicio.cronograma_mantenimientos
- servicio.cronograma_mantenimientos_anuales
- users

## 7. Requerimientos funcionales de alto nivel
- REQ-PRPU-001: El sistema debe permitir consultar y listar informacion operativa del modulo Pedidos de Compra Privada segun los permisos del actor.
- REQ-PRPU-002: El sistema debe permitir registrar nuevas operaciones/transacciones del modulo Pedidos de Compra Privada con validaciones de entrada.
- REQ-PRPU-003: El sistema debe permitir actualizar datos y estados del modulo Pedidos de Compra Privada preservando trazabilidad.
- REQ-PRPU-004: El sistema debe controlar cambios de estado/aprobacion del proceso en Pedidos de Compra Privada segun reglas y roles definidos.
- REQ-PRPU-005: El sistema debe permitir gestionar evidencia documental asociada al modulo Pedidos de Compra Privada, incluyendo carga y consulta.
- REQ-PRPU-006: El sistema debe permitir generar salidas de control (reportes, resumenes o metricas) para seguimiento del modulo Pedidos de Compra Privada.
- REQ-PRPU-007: El sistema debe interoperar con integraciones externas del modulo Pedidos de Compra Privada: Calendario, Eventos en tiempo real, Generacion documental PDF, Google OAuth/Drive.

## 8. Requerimientos no funcionales
- RNF-PRPU-001: El modulo debe aplicar control de acceso por autenticacion y autorizacion acorde a la sensibilidad del proceso.
- RNF-PRPU-002: El modulo debe mantener integridad de datos en operaciones de escritura, con manejo transaccional cuando aplique.
- RNF-PRPU-003: El modulo debe registrar trazabilidad/auditoria de acciones criticas para soporte de control interno.
- RNF-PRPU-004: El modulo debe gestionar errores de forma estandarizada, devolviendo codigos y mensajes tecnicos consumibles por frontend.
- RNF-PRPU-005: El modulo debe proteger datos sensibles en transito y en almacenamiento, segun politicas de seguridad del sistema.
- RNF-PRPU-006: El modulo debe sostener rendimiento operativo en consultas y operaciones frecuentes del proceso.
- RNF-PRPU-007: El modulo debe soportar disponibilidad operativa para jornadas internas y continuidad de procesos.
- RNF-PRPU-008: El modulo debe ser mantenible, con separacion clara de rutas, controladores y servicios en el codigo actual.

## 9. Reglas de negocio
- RN-PRPU-001: Solo los roles autorizados pueden ejecutar operaciones sensibles del modulo: acp_comercial, backoffice_comercial, jefe_comercial, jefe_servicio_tecnico, jefe_tecnico.
- RN-PRPU-002: Los cambios de estado deben respetar la secuencia de negocio definida por la logica actual del modulo.
- RN-PRPU-003: Las operaciones del modulo deben persistir informacion en las tablas asociadas manteniendo consistencia de datos.
- RN-PRPU-004: Las integraciones externas del modulo deben ejecutarse con tolerancia a fallos y trazabilidad de incidencias.
- RN-PRPU-005: [Funcionalidad detectada en el sistema] Se identifican reglas implicitas implementadas en servicios/controladores que deben formalizarse en el FRS.

## 10. Dependencias con otros modulos
- Calendario
- Caso de Negocio
- Notificaciones
- Solicitudes
- Integraciones externas detectadas: Calendario, Eventos en tiempo real, Generacion documental PDF, Google OAuth/Drive.

