# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Pedidos de Compra Publica

## 1. Introduccion
Este documento presenta la propuesta de requerimientos del modulo Pedidos de Compra Publica del Sistema de Procesos Internos SPI, elaborada mediante ingenieria inversa del codigo fuente vigente.

## 2. Objetivo del modulo
Definir y controlar las capacidades funcionales que el sistema debe ofrecer en el ambito de Pedidos de Compra Publica para soportar procesos internos del negocio.

## 3. Alcance funcional
- Gestion de capacidades de negocio implementadas en el modulo Pedidos de Compra Publica.
- Ejecucion de flujos CRUD/transaccionales soportados por rutas y servicios actuales.
- Consumo de componentes frontend vinculados y contratos API del backend.
- Aplicacion de controles de seguridad, validacion y trazabilidad detectados en el codigo.

## 4. Actores del sistema
- Acp Comercial
- Servicios/integraciones externas del modulo
- Usuario autenticado del proceso interno

## 5. Descripcion general del modulo
El modulo Pedidos de Compra Publica se implementa principalmente en backend/src/modules/equipment-purchases y se integra con la arquitectura API del sistema mediante rutas, controladores y servicios. Su comportamiento funcional actual se apoya en validaciones de entrada, control de permisos y trazabilidad operativa.

## 6. Funcionalidades identificadas
- Operacion API detectada: GET /.
- Operacion API detectada: GET /:id.
- Operacion API detectada: GET /events.
- Operacion API detectada: GET /meta.
- Operacion API detectada: GET /provider-contacts.
- Operacion API detectada: GET /stats.
- Operacion API detectada: GET /technical-schedule.
- Operacion API detectada: PATCH /:id/checklist.
- Operacion API detectada: PATCH /:id/coordinate-inspection-date.
- Operacion API detectada: PATCH /:id/public-portal-outcome.
- Operacion API detectada: PATCH /:id/review-inspection-date.
- Operacion API detectada: PATCH /:id/site-inspection.
- Operacion API detectada: POST /.
- Operacion API detectada: POST /:id/cancel-order.
- Operacion API detectada: POST /:id/complete-delivery.
- Operacion API detectada: POST /:id/mark-dispatch-ready.
- Operacion API detectada: POST /:id/mark-equipment-arrived.
- Operacion API detectada: POST /:id/provider-response.
- Operacion API detectada: POST /:id/renew-reservation.
- Operacion API detectada: POST /:id/request-delivery-dates.
- Operacion API detectada: POST /:id/request-inspection.
- Operacion API detectada: POST /:id/request-proforma.
- Operacion API detectada: POST /:id/reserve.
- Operacion API detectada: POST /:id/start-availability.
- Operacion API detectada: POST /:id/submit-delivery-dates.
- Operacion API detectada: POST /:id/submit-signed-proforma-with-inspection.
- Operacion API detectada: POST /:id/upload-contract.
- Operacion API detectada: POST /:id/upload-proforma.
- Operacion API detectada: POST /:id/upload-signed-proforma.
- Operacion API detectada: POST /provider-contacts.
- [Funcionalidad detectada en el sistema] Persistencia/transaccion sobre tablas: client_requests, equipment_purchase_provider_contacts, equipment_purchase_requests, information_schema.columns, pg_constraint, private_purchase_requests, public.equipos_modelo, public.equipos_unidad, request_types, requests, servicio.cronograma_actividades_tecnicas, servicio.cronograma_capacitacion, servicio.cronograma_mantenimientos, users.

### Endpoints de API detectados
- GET /
- GET /:id
- GET /events
- GET /meta
- GET /provider-contacts
- GET /stats
- GET /technical-schedule
- PATCH /:id/checklist
- PATCH /:id/coordinate-inspection-date
- PATCH /:id/public-portal-outcome
- PATCH /:id/review-inspection-date
- PATCH /:id/site-inspection
- POST /
- POST /:id/cancel-order
- POST /:id/complete-delivery
- POST /:id/mark-dispatch-ready
- POST /:id/mark-equipment-arrived
- POST /:id/provider-response
- POST /:id/renew-reservation
- POST /:id/request-delivery-dates
- POST /:id/request-inspection
- POST /:id/request-proforma
- POST /:id/reserve
- POST /:id/start-availability
- POST /:id/submit-delivery-dates
- POST /:id/submit-signed-proforma-with-inspection
- POST /:id/upload-contract
- POST /:id/upload-proforma
- POST /:id/upload-signed-proforma
- POST /provider-contacts

### Componentes del sistema
- backend\src\modules\equipment-purchases\equipmentPurchases.controller.js
- backend\src\modules\equipment-purchases\equipmentPurchases.routes.js
- backend\src\modules\equipment-purchases\equipmentPurchases.service.js

### Componentes frontend relacionados
- spi_front\src\core\api\equipmentPurchasesApi.js

### Tablas/entidades de datos detectadas
- client_requests
- equipment_purchase_provider_contacts
- equipment_purchase_requests
- information_schema.columns
- pg_constraint
- private_purchase_requests
- public.equipos_modelo
- public.equipos_unidad
- request_types
- requests
- servicio.cronograma_actividades_tecnicas
- servicio.cronograma_capacitacion
- servicio.cronograma_mantenimientos
- users

## 7. Requerimientos funcionales de alto nivel
- REQ-EQPU-001: El sistema debe permitir consultar y listar informacion operativa del modulo Pedidos de Compra Publica segun los permisos del actor.
- REQ-EQPU-002: El sistema debe permitir registrar nuevas operaciones/transacciones del modulo Pedidos de Compra Publica con validaciones de entrada.
- REQ-EQPU-003: El sistema debe permitir actualizar datos y estados del modulo Pedidos de Compra Publica preservando trazabilidad.
- REQ-EQPU-004: El sistema debe permitir gestionar evidencia documental asociada al modulo Pedidos de Compra Publica, incluyendo carga y consulta.
- REQ-EQPU-005: El sistema debe permitir generar salidas de control (reportes, resumenes o metricas) para seguimiento del modulo Pedidos de Compra Publica.
- REQ-EQPU-006: El sistema debe interoperar con integraciones externas del modulo Pedidos de Compra Publica: Calendario, Correo corporativo, Eventos en tiempo real, Generacion documental PDF, Google OAuth/Drive.

## 8. Requerimientos no funcionales
- RNF-EQPU-001: El modulo debe aplicar control de acceso por autenticacion y autorizacion acorde a la sensibilidad del proceso.
- RNF-EQPU-002: El modulo debe mantener integridad de datos en operaciones de escritura, con manejo transaccional cuando aplique.
- RNF-EQPU-003: El modulo debe registrar trazabilidad/auditoria de acciones criticas para soporte de control interno.
- RNF-EQPU-004: El modulo debe gestionar errores de forma estandarizada, devolviendo codigos y mensajes tecnicos consumibles por frontend.
- RNF-EQPU-005: El modulo debe proteger datos sensibles en transito y en almacenamiento, segun politicas de seguridad del sistema.
- RNF-EQPU-006: El modulo debe sostener rendimiento operativo en consultas y operaciones frecuentes del proceso.
- RNF-EQPU-007: El modulo debe soportar disponibilidad operativa para jornadas internas y continuidad de procesos.
- RNF-EQPU-008: El modulo debe ser mantenible, con separacion clara de rutas, controladores y servicios en el codigo actual.

## 9. Reglas de negocio
- RN-EQPU-001: Solo los roles autorizados pueden ejecutar operaciones sensibles del modulo: acp_comercial.
- RN-EQPU-002: Las operaciones del modulo deben persistir informacion en las tablas asociadas manteniendo consistencia de datos.
- RN-EQPU-003: Las integraciones externas del modulo deben ejecutarse con tolerancia a fallos y trazabilidad de incidencias.
- RN-EQPU-004: [Funcionalidad detectada en el sistema] Se identifican reglas implicitas implementadas en servicios/controladores que deben formalizarse en el FRS.

## 10. Dependencias con otros modulos
- Caso de Negocio
- Inventario
- Notificaciones
- Solicitudes
- Integraciones externas detectadas: Calendario, Correo corporativo, Eventos en tiempo real, Generacion documental PDF, Google OAuth/Drive.

