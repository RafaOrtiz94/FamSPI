# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Asistencia

## 1. Introduccion
Este documento presenta la propuesta de requerimientos del modulo Asistencia del Sistema de Procesos Internos SPI, elaborada mediante ingenieria inversa del codigo fuente vigente.

## 2. Objetivo del modulo
Definir y controlar las capacidades funcionales que el sistema debe ofrecer en el ambito de Asistencia para soportar procesos internos del negocio.

## 3. Alcance funcional
- Gestion de capacidades de negocio implementadas en el modulo Asistencia.
- Ejecucion de flujos CRUD/transaccionales soportados por rutas y servicios actuales.
- Consumo de componentes frontend vinculados y contratos API del backend.
- Aplicacion de controles de seguridad, validacion y trazabilidad detectados en el codigo.

## 4. Actores del sistema
- Servicios/integraciones externas del modulo
- Usuario autenticado del proceso interno

## 5. Descripcion general del modulo
El modulo Asistencia se implementa principalmente en backend/src/modules/attendance y se integra con la arquitectura API del sistema mediante rutas, controladores y servicios. Su comportamiento funcional actual se apoya en validaciones de entrada, control de permisos y trazabilidad operativa.

## 6. Funcionalidades identificadas
- Operacion API detectada: GET /exception/active.
- Operacion API detectada: GET /overtime.
- Operacion API detectada: GET /pdf/:userId.
- Operacion API detectada: GET /range.
- Operacion API detectada: GET /today.
- Operacion API detectada: GET /user/:userId.
- Operacion API detectada: POST /clock-in.
- Operacion API detectada: POST /clock-in-lunch.
- Operacion API detectada: POST /clock-out.
- Operacion API detectada: POST /clock-out-lunch.
- Operacion API detectada: POST /exception.
- Operacion API detectada: POST /exception/status.
- Operacion API detectada: POST /overtime.
- [Funcionalidad detectada en el sistema] Persistencia/transaccion sobre tablas: attendance_exceptions, attendance_overtime, departments, drive, exception, exit, google, lunch, record, user_attendance_records, users.

### Endpoints de API detectados
- GET /exception/active
- GET /overtime
- GET /pdf/:userId
- GET /range
- GET /today
- GET /user/:userId
- POST /clock-in
- POST /clock-in-lunch
- POST /clock-out
- POST /clock-out-lunch
- POST /exception
- POST /exception/status
- POST /overtime

### Componentes del sistema
- backend\src\modules\attendance\attendance.controller.js
- backend\src\modules\attendance\attendance.routes.js
- backend\src\modules\attendance\attendance.service.js

### Componentes frontend relacionados
- spi_front\src\core\api\attendanceApi.js

### Tablas/entidades de datos detectadas
- attendance_exceptions
- attendance_overtime
- departments
- drive
- exception
- exit
- google
- lunch
- record
- user_attendance_records
- users

## 7. Requerimientos funcionales de alto nivel
- REQ-ATTE-001: El sistema debe permitir consultar y listar informacion operativa del modulo Asistencia segun los permisos del actor.
- REQ-ATTE-002: El sistema debe permitir registrar nuevas operaciones/transacciones del modulo Asistencia con validaciones de entrada.
- REQ-ATTE-003: El sistema debe controlar cambios de estado/aprobacion del proceso en Asistencia segun reglas y roles definidos.
- REQ-ATTE-004: El sistema debe permitir generar salidas de control (reportes, resumenes o metricas) para seguimiento del modulo Asistencia.
- REQ-ATTE-005: El sistema debe interoperar con integraciones externas del modulo Asistencia: Eventos en tiempo real, Generacion documental PDF, Google OAuth/Drive.

## 8. Requerimientos no funcionales
- RNF-ATTE-001: El modulo debe aplicar control de acceso por autenticacion y autorizacion acorde a la sensibilidad del proceso.
- RNF-ATTE-002: El modulo debe mantener integridad de datos en operaciones de escritura, con manejo transaccional cuando aplique.
- RNF-ATTE-003: El modulo debe registrar trazabilidad/auditoria de acciones criticas para soporte de control interno.
- RNF-ATTE-004: El modulo debe gestionar errores de forma estandarizada, devolviendo codigos y mensajes tecnicos consumibles por frontend.
- RNF-ATTE-005: El modulo debe proteger datos sensibles en transito y en almacenamiento, segun politicas de seguridad del sistema.
- RNF-ATTE-006: El modulo debe sostener rendimiento operativo en consultas y operaciones frecuentes del proceso.
- RNF-ATTE-007: El modulo debe soportar disponibilidad operativa para jornadas internas y continuidad de procesos.
- RNF-ATTE-008: El modulo debe ser mantenible, con separacion clara de rutas, controladores y servicios en el codigo actual.

## 9. Reglas de negocio
- RN-ATTE-001: Las operaciones del modulo deben ejecutarse solo por actores autenticados con permisos efectivos del contexto.
- RN-ATTE-002: Los cambios de estado deben respetar la secuencia de negocio definida por la logica actual del modulo.
- RN-ATTE-003: Las operaciones del modulo deben persistir informacion en las tablas asociadas manteniendo consistencia de datos.
- RN-ATTE-004: Las integraciones externas del modulo deben ejecutarse con tolerancia a fallos y trazabilidad de incidencias.
- RN-ATTE-005: [Funcionalidad detectada en el sistema] Se identifican reglas implicitas implementadas en servicios/controladores que deben formalizarse en el FRS.

## 10. Dependencias con otros modulos
- El modulo opera con acoplamiento interno minimo; no se detectaron dependencias directas explicitas hacia otros modulos de negocio.
- Integraciones externas detectadas: Eventos en tiempo real, Generacion documental PDF, Google OAuth/Drive.

