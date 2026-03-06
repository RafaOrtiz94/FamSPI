# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Tickets de Soporte

## 1. Introduccion
Este documento presenta la propuesta de requerimientos del modulo Tickets de Soporte del Sistema de Procesos Internos SPI, elaborada mediante ingenieria inversa del codigo fuente vigente.

## 2. Objetivo del modulo
Definir y controlar las capacidades funcionales que el sistema debe ofrecer en el ambito de Tickets de Soporte para soportar procesos internos del negocio.

## 3. Alcance funcional
- Gestion de capacidades de negocio implementadas en el modulo Tickets de Soporte.
- Ejecucion de flujos CRUD/transaccionales soportados por rutas y servicios actuales.
- Consumo de componentes frontend vinculados y contratos API del backend.
- Aplicacion de controles de seguridad, validacion y trazabilidad detectados en el codigo.

## 4. Actores del sistema
- Servicios/integraciones externas del modulo
- Usuario autenticado del proceso interno

## 5. Descripcion general del modulo
El modulo Tickets de Soporte se implementa principalmente en backend/src/modules/support-tickets y se integra con la arquitectura API del sistema mediante rutas, controladores y servicios. Su comportamiento funcional actual se apoya en validaciones de entrada, control de permisos y trazabilidad operativa.

## 6. Funcionalidades identificadas
- Operacion API detectada: GET /:id/comments.
- Operacion API detectada: GET /:id/events.
- Operacion API detectada: GET /my.
- Operacion API detectada: GET /workspace/kpi.
- Operacion API detectada: GET /workspace/list.
- Operacion API detectada: PATCH /:id/assign-self.
- Operacion API detectada: PATCH /:id/status.
- Operacion API detectada: POST /.
- Operacion API detectada: POST /:id/close.
- Operacion API detectada: POST /:id/comments.
- Operacion API detectada: POST /:id/reopen.
- Operacion API detectada: POST /:id/satisfaction.
- [Funcionalidad detectada en el sistema] Persistencia/transaccion sobre tablas: lateral, support_ticket_comments, support_ticket_events, support_tickets, users.

### Endpoints de API detectados
- GET /:id/comments
- GET /:id/events
- GET /my
- GET /workspace/kpi
- GET /workspace/list
- PATCH /:id/assign-self
- PATCH /:id/status
- POST /
- POST /:id/close
- POST /:id/comments
- POST /:id/reopen
- POST /:id/satisfaction

### Componentes del sistema
- backend\src\modules\support-tickets\supportTickets.controller.js
- backend\src\modules\support-tickets\supportTickets.routes.js
- backend\src\modules\support-tickets\supportTickets.service.js

### Componentes frontend relacionados
- spi_front\src\core\api\supportTicketsApi.js

### Tablas/entidades de datos detectadas
- lateral
- support_ticket_comments
- support_ticket_events
- support_tickets
- users

## 7. Requerimientos funcionales de alto nivel
- REQ-SUTI-001: El sistema debe permitir consultar y listar informacion operativa del modulo Tickets de Soporte segun los permisos del actor.
- REQ-SUTI-002: El sistema debe permitir registrar nuevas operaciones/transacciones del modulo Tickets de Soporte con validaciones de entrada.
- REQ-SUTI-003: El sistema debe permitir actualizar datos y estados del modulo Tickets de Soporte preservando trazabilidad.
- REQ-SUTI-004: El sistema debe controlar cambios de estado/aprobacion del proceso en Tickets de Soporte segun reglas y roles definidos.
- REQ-SUTI-005: El sistema debe interoperar con integraciones externas del modulo Tickets de Soporte: Eventos en tiempo real.

## 8. Requerimientos no funcionales
- RNF-SUTI-001: El modulo debe aplicar control de acceso por autenticacion y autorizacion acorde a la sensibilidad del proceso.
- RNF-SUTI-002: El modulo debe mantener integridad de datos en operaciones de escritura, con manejo transaccional cuando aplique.
- RNF-SUTI-003: El modulo debe registrar trazabilidad/auditoria de acciones criticas para soporte de control interno.
- RNF-SUTI-004: El modulo debe gestionar errores de forma estandarizada, devolviendo codigos y mensajes tecnicos consumibles por frontend.
- RNF-SUTI-005: El modulo debe proteger datos sensibles en transito y en almacenamiento, segun politicas de seguridad del sistema.
- RNF-SUTI-006: El modulo debe sostener rendimiento operativo en consultas y operaciones frecuentes del proceso.
- RNF-SUTI-007: El modulo debe soportar disponibilidad operativa para jornadas internas y continuidad de procesos.
- RNF-SUTI-008: El modulo debe ser mantenible, con separacion clara de rutas, controladores y servicios en el codigo actual.

## 9. Reglas de negocio
- RN-SUTI-001: Las operaciones del modulo deben ejecutarse solo por actores autenticados con permisos efectivos del contexto.
- RN-SUTI-002: Los cambios de estado deben respetar la secuencia de negocio definida por la logica actual del modulo.
- RN-SUTI-003: Las operaciones del modulo deben persistir informacion en las tablas asociadas manteniendo consistencia de datos.
- RN-SUTI-004: Las integraciones externas del modulo deben ejecutarse con tolerancia a fallos y trazabilidad de incidencias.
- RN-SUTI-005: [Funcionalidad detectada en el sistema] Se identifican reglas implicitas implementadas en servicios/controladores que deben formalizarse en el FRS.

## 10. Dependencias con otros modulos
- Notificaciones
- Integraciones externas detectadas: Eventos en tiempo real.

