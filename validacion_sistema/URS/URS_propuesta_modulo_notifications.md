# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Notificaciones

## 1. Introduccion
Este documento presenta la propuesta de requerimientos del modulo Notificaciones del Sistema de Procesos Internos SPI, elaborada mediante ingenieria inversa del codigo fuente vigente.

## 2. Objetivo del modulo
Definir y controlar las capacidades funcionales que el sistema debe ofrecer en el ambito de Notificaciones para soportar procesos internos del negocio.

## 3. Alcance funcional
- Gestion de capacidades de negocio implementadas en el modulo Notificaciones.
- Ejecucion de flujos CRUD/transaccionales soportados por rutas y servicios actuales.
- Consumo de componentes frontend vinculados y contratos API del backend.
- Aplicacion de controles de seguridad, validacion y trazabilidad detectados en el codigo.

## 4. Actores del sistema
- Servicios/integraciones externas del modulo
- Usuario autenticado del proceso interno

## 5. Descripcion general del modulo
El modulo Notificaciones se implementa principalmente en backend/src/modules/notifications y se integra con la arquitectura API del sistema mediante rutas, controladores y servicios. Su comportamiento funcional actual se apoya en validaciones de entrada, control de permisos y trazabilidad operativa.

## 6. Funcionalidades identificadas
- Operacion API detectada: DELETE /:id.
- Operacion API detectada: DELETE /clear.
- Operacion API detectada: GET /.
- Operacion API detectada: PATCH /:id/read.
- Operacion API detectada: PATCH /read-all.
- Operacion API detectada: POST /.
- [Funcionalidad detectada en el sistema] Persistencia/transaccion sobre tablas: an, notification_dispatch_queue, notification_process_email_threads, notification_recipients_config, notifications, skip, users.

### Endpoints de API detectados
- DELETE /:id
- DELETE /clear
- GET /
- PATCH /:id/read
- PATCH /read-all
- POST /

### Componentes del sistema
- backend\src\modules\notifications\notificationRecipientsConfig.service.js
- backend\src\modules\notifications\notifications.controller.js
- backend\src\modules\notifications\notifications.routes.js
- backend\src\modules\notifications\notifications.service.js

### Componentes frontend relacionados
- spi_front\src\core\api\notificationsApi.js

### Tablas/entidades de datos detectadas
- an
- notification_dispatch_queue
- notification_process_email_threads
- notification_recipients_config
- notifications
- skip
- users

## 7. Requerimientos funcionales de alto nivel
- REQ-NOTI-001: El sistema debe permitir consultar y listar informacion operativa del modulo Notificaciones segun los permisos del actor.
- REQ-NOTI-002: El sistema debe permitir registrar nuevas operaciones/transacciones del modulo Notificaciones con validaciones de entrada.
- REQ-NOTI-003: El sistema debe permitir actualizar datos y estados del modulo Notificaciones preservando trazabilidad.
- REQ-NOTI-004: El sistema debe permitir ejecutar eliminaciones controladas del modulo Notificaciones cuando el flujo de negocio lo permita.
- REQ-NOTI-005: El sistema debe interoperar con integraciones externas del modulo Notificaciones: Calendario, Correo corporativo, Eventos en tiempo real, Google OAuth/Drive.

## 8. Requerimientos no funcionales
- RNF-NOTI-001: El modulo debe aplicar control de acceso por autenticacion y autorizacion acorde a la sensibilidad del proceso.
- RNF-NOTI-002: El modulo debe mantener integridad de datos en operaciones de escritura, con manejo transaccional cuando aplique.
- RNF-NOTI-003: El modulo debe registrar trazabilidad/auditoria de acciones criticas para soporte de control interno.
- RNF-NOTI-004: El modulo debe gestionar errores de forma estandarizada, devolviendo codigos y mensajes tecnicos consumibles por frontend.
- RNF-NOTI-005: El modulo debe proteger datos sensibles en transito y en almacenamiento, segun politicas de seguridad del sistema.
- RNF-NOTI-006: El modulo debe sostener rendimiento operativo en consultas y operaciones frecuentes del proceso.
- RNF-NOTI-007: El modulo debe soportar disponibilidad operativa para jornadas internas y continuidad de procesos.
- RNF-NOTI-008: El modulo debe ser mantenible, con separacion clara de rutas, controladores y servicios en el codigo actual.

## 9. Reglas de negocio
- RN-NOTI-001: Las operaciones del modulo deben ejecutarse solo por actores autenticados con permisos efectivos del contexto.
- RN-NOTI-002: Las operaciones del modulo deben persistir informacion en las tablas asociadas manteniendo consistencia de datos.
- RN-NOTI-003: Las integraciones externas del modulo deben ejecutarse con tolerancia a fallos y trazabilidad de incidencias.
- RN-NOTI-004: [Funcionalidad detectada en el sistema] Se identifican reglas implicitas implementadas en servicios/controladores que deben formalizarse en el FRS.

## 10. Dependencias con otros modulos
- El modulo opera con acoplamiento interno minimo; no se detectaron dependencias directas explicitas hacia otros modulos de negocio.
- Integraciones externas detectadas: Calendario, Correo corporativo, Eventos en tiempo real, Google OAuth/Drive.

