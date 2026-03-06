# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Cronogramas

## 1. Introduccion
Este documento presenta la propuesta de requerimientos del modulo Cronogramas del Sistema de Procesos Internos SPI, elaborada mediante ingenieria inversa del codigo fuente vigente.

## 2. Objetivo del modulo
Definir y controlar las capacidades funcionales que el sistema debe ofrecer en el ambito de Cronogramas para soportar procesos internos del negocio.

## 3. Alcance funcional
- Gestion de capacidades de negocio implementadas en el modulo Cronogramas.
- Ejecucion de flujos CRUD/transaccionales soportados por rutas y servicios actuales.
- Consumo de componentes frontend vinculados y contratos API del backend.
- Aplicacion de controles de seguridad, validacion y trazabilidad detectados en el codigo.

## 4. Actores del sistema
- Servicios/integraciones externas del modulo
- Usuario autenticado del proceso interno

## 5. Descripcion general del modulo
El modulo Cronogramas se implementa principalmente en backend/src/modules/schedules y se integra con la arquitectura API del sistema mediante rutas, controladores y servicios. Su comportamiento funcional actual se apoya en validaciones de entrada, control de permisos y trazabilidad operativa.

## 6. Funcionalidades identificadas
- Operacion API detectada: DELETE /:id.
- Operacion API detectada: DELETE /:id/visits/:visitId.
- Operacion API detectada: GET /.
- Operacion API detectada: GET /:id.
- Operacion API detectada: GET /analytics.
- Operacion API detectada: GET /approved/current.
- Operacion API detectada: GET /pending-approval.
- Operacion API detectada: GET /team.
- Operacion API detectada: POST /.
- Operacion API detectada: POST /:id/approve.
- Operacion API detectada: POST /:id/reject.
- Operacion API detectada: POST /:id/submit.
- Operacion API detectada: POST /:id/visits.
- Operacion API detectada: PUT /:id.
- Operacion API detectada: PUT /:id/visits/:visitId.
- [Funcionalidad detectada en el sistema] Persistencia/transaccion sobre tablas: client_requests, client_visit_logs, cvl.visit_date, prospect_visits, scheduled_visits, users, visit_schedules.

### Endpoints de API detectados
- DELETE /:id
- DELETE /:id/visits/:visitId
- GET /
- GET /:id
- GET /analytics
- GET /approved/current
- GET /pending-approval
- GET /team
- POST /
- POST /:id/approve
- POST /:id/reject
- POST /:id/submit
- POST /:id/visits
- PUT /:id
- PUT /:id/visits/:visitId

### Componentes del sistema
- backend\src\modules\schedules\schedules.controller.js
- backend\src\modules\schedules\schedules.routes.js
- backend\src\modules\schedules\schedules.service.js

### Componentes frontend relacionados
- spi_front\src\core\api\schedulesApi.js

### Tablas/entidades de datos detectadas
- client_requests
- client_visit_logs
- cvl.visit_date
- prospect_visits
- scheduled_visits
- users
- visit_schedules

## 7. Requerimientos funcionales de alto nivel
- REQ-SCHE-001: El sistema debe permitir consultar y listar informacion operativa del modulo Cronogramas segun los permisos del actor.
- REQ-SCHE-002: El sistema debe permitir registrar nuevas operaciones/transacciones del modulo Cronogramas con validaciones de entrada.
- REQ-SCHE-003: El sistema debe permitir actualizar datos y estados del modulo Cronogramas preservando trazabilidad.
- REQ-SCHE-004: El sistema debe permitir ejecutar eliminaciones controladas del modulo Cronogramas cuando el flujo de negocio lo permita.
- REQ-SCHE-005: El sistema debe controlar cambios de estado/aprobacion del proceso en Cronogramas segun reglas y roles definidos.
- REQ-SCHE-006: El sistema debe interoperar con integraciones externas del modulo Cronogramas: Eventos en tiempo real.

## 8. Requerimientos no funcionales
- RNF-SCHE-001: El modulo debe aplicar control de acceso por autenticacion y autorizacion acorde a la sensibilidad del proceso.
- RNF-SCHE-002: El modulo debe mantener integridad de datos en operaciones de escritura, con manejo transaccional cuando aplique.
- RNF-SCHE-003: El modulo debe registrar trazabilidad/auditoria de acciones criticas para soporte de control interno.
- RNF-SCHE-004: El modulo debe gestionar errores de forma estandarizada, devolviendo codigos y mensajes tecnicos consumibles por frontend.
- RNF-SCHE-005: El modulo debe proteger datos sensibles en transito y en almacenamiento, segun politicas de seguridad del sistema.
- RNF-SCHE-006: El modulo debe sostener rendimiento operativo en consultas y operaciones frecuentes del proceso.
- RNF-SCHE-007: El modulo debe soportar disponibilidad operativa para jornadas internas y continuidad de procesos.
- RNF-SCHE-008: El modulo debe ser mantenible, con separacion clara de rutas, controladores y servicios en el codigo actual.

## 9. Reglas de negocio
- RN-SCHE-001: Las operaciones del modulo deben ejecutarse solo por actores autenticados con permisos efectivos del contexto.
- RN-SCHE-002: Los cambios de estado deben respetar la secuencia de negocio definida por la logica actual del modulo.
- RN-SCHE-003: Las operaciones del modulo deben persistir informacion en las tablas asociadas manteniendo consistencia de datos.
- RN-SCHE-004: Las integraciones externas del modulo deben ejecutarse con tolerancia a fallos y trazabilidad de incidencias.
- RN-SCHE-005: [Funcionalidad detectada en el sistema] Se identifican reglas implicitas implementadas en servicios/controladores que deben formalizarse en el FRS.

## 10. Dependencias con otros modulos
- El modulo opera con acoplamiento interno minimo; no se detectaron dependencias directas explicitas hacia otros modulos de negocio.
- Integraciones externas detectadas: Eventos en tiempo real.

