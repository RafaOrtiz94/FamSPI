# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Seguridad

## 1. Introduccion
Este documento presenta la propuesta de requerimientos del modulo Seguridad del Sistema de Procesos Internos SPI, elaborada mediante ingenieria inversa del codigo fuente vigente.

## 2. Objetivo del modulo
Definir y controlar las capacidades funcionales que el sistema debe ofrecer en el ambito de Seguridad para soportar procesos internos del negocio.

## 3. Alcance funcional
- Gestion de capacidades de negocio implementadas en el modulo Seguridad.
- Ejecucion de flujos CRUD/transaccionales soportados por rutas y servicios actuales.
- Consumo de componentes frontend vinculados y contratos API del backend.
- Aplicacion de controles de seguridad, validacion y trazabilidad detectados en el codigo.

## 4. Actores del sistema
- Servicios/integraciones externas del modulo
- Ti
- Usuario autenticado del proceso interno

## 5. Descripcion general del modulo
El modulo Seguridad se implementa principalmente en backend/src/modules/security y se integra con la arquitectura API del sistema mediante rutas, controladores y servicios. Su comportamiento funcional actual se apoya en validaciones de entrada, control de permisos y trazabilidad operativa.

## 6. Funcionalidades identificadas
- Operacion API detectada: GET /offhours-logins.
- Operacion API detectada: GET /offhours-logins/:id/timeline.
- Operacion API detectada: GET /offhours-logins/export.
- Operacion API detectada: POST /dev/emit-offhours.
- Operacion API detectada: POST /offhours-logins/:id/review.
- [Funcionalidad detectada en el sistema] Persistencia/transaccion sobre tablas: auditoria.logs, departments, notifications, security_jobs_log, security_offhours_whitelist, user_sessions, users.

### Endpoints de API detectados
- GET /offhours-logins
- GET /offhours-logins/:id/timeline
- GET /offhours-logins/export
- POST /dev/emit-offhours
- POST /offhours-logins/:id/review

### Componentes del sistema
- backend\src\modules\security\security.controller.js
- backend\src\modules\security\security.routes.js

### Componentes frontend relacionados
- No se identificaron referencias frontend directas para este modulo.

### Tablas/entidades de datos detectadas
- auditoria.logs
- departments
- notifications
- security_jobs_log
- security_offhours_whitelist
- user_sessions
- users

## 7. Requerimientos funcionales de alto nivel
- REQ-SECU-001: El sistema debe permitir consultar y listar informacion operativa del modulo Seguridad segun los permisos del actor.
- REQ-SECU-002: El sistema debe permitir registrar nuevas operaciones/transacciones del modulo Seguridad con validaciones de entrada.
- REQ-SECU-003: El sistema debe permitir generar salidas de control (reportes, resumenes o metricas) para seguimiento del modulo Seguridad.
- REQ-SECU-004: El sistema debe interoperar con integraciones externas del modulo Seguridad: APIs HTTP externas, Eventos en tiempo real.
- REQ-SECU-005: [Funcionalidad detectada en el sistema] El modulo Seguridad incluye logica interna adicional en servicios/controladores no expuesta completamente por contratos funcionales formales.
- REQ-SECU-006: El sistema debe garantizar ejecucion consistente de la logica de negocio del modulo Seguridad en escenarios nominales y de error.

## 8. Requerimientos no funcionales
- RNF-SECU-001: El modulo debe aplicar control de acceso por autenticacion y autorizacion acorde a la sensibilidad del proceso.
- RNF-SECU-002: El modulo debe mantener integridad de datos en operaciones de escritura, con manejo transaccional cuando aplique.
- RNF-SECU-003: El modulo debe registrar trazabilidad/auditoria de acciones criticas para soporte de control interno.
- RNF-SECU-004: El modulo debe gestionar errores de forma estandarizada, devolviendo codigos y mensajes tecnicos consumibles por frontend.
- RNF-SECU-005: El modulo debe proteger datos sensibles en transito y en almacenamiento, segun politicas de seguridad del sistema.
- RNF-SECU-006: El modulo debe sostener rendimiento operativo en consultas y operaciones frecuentes del proceso.
- RNF-SECU-007: El modulo debe soportar disponibilidad operativa para jornadas internas y continuidad de procesos.
- RNF-SECU-008: El modulo debe ser mantenible, con separacion clara de rutas, controladores y servicios en el codigo actual.

## 9. Reglas de negocio
- RN-SECU-001: Solo los roles autorizados pueden ejecutar operaciones sensibles del modulo: ti.
- RN-SECU-002: Las operaciones del modulo deben persistir informacion en las tablas asociadas manteniendo consistencia de datos.
- RN-SECU-003: Las integraciones externas del modulo deben ejecutarse con tolerancia a fallos y trazabilidad de incidencias.
- RN-SECU-004: [Funcionalidad detectada en el sistema] Se identifican reglas implicitas implementadas en servicios/controladores que deben formalizarse en el FRS.

## 10. Dependencias con otros modulos
- El modulo opera con acoplamiento interno minimo; no se detectaron dependencias directas explicitas hacia otros modulos de negocio.
- Integraciones externas detectadas: APIs HTTP externas, Eventos en tiempo real.

