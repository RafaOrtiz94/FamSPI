# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Autenticacion

## 1. Introduccion
Este documento presenta la propuesta de requerimientos del modulo Autenticacion del Sistema de Procesos Internos SPI, elaborada mediante ingenieria inversa del codigo fuente vigente.

## 2. Objetivo del modulo
Definir y controlar las capacidades funcionales que el sistema debe ofrecer en el ambito de Autenticacion para soportar procesos internos del negocio.

## 3. Alcance funcional
- Gestion de capacidades de negocio implementadas en el modulo Autenticacion.
- Ejecucion de flujos CRUD/transaccionales soportados por rutas y servicios actuales.
- Consumo de componentes frontend vinculados y contratos API del backend.
- Aplicacion de controles de seguridad, validacion y trazabilidad detectados en el codigo.

## 4. Actores del sistema
- Gerencia
- Servicios/integraciones externas del modulo
- Ti
- Usuario autenticado del proceso interno

## 5. Descripcion general del modulo
El modulo Autenticacion se implementa principalmente en backend/src/modules/auth y se integra con la arquitectura API del sistema mediante rutas, controladores y servicios. Su comportamiento funcional actual se apoya en validaciones de entrada, control de permisos y trazabilidad operativa.

## 6. Funcionalidades identificadas
- Operacion API detectada: GET /active-users.
- Operacion API detectada: GET /google.
- Operacion API detectada: GET /google/callback.
- Operacion API detectada: GET /me.
- Operacion API detectada: GET /sessions.
- Operacion API detectada: POST /logout.
- Operacion API detectada: POST /lopdp/accept.
- Operacion API detectada: POST /refresh.
- [Funcionalidad detectada en el sistema] Persistencia/transaccion sobre tablas: departments, user_attendance_records, user_lopdp_consents, user_profile, user_sessions, users.

### Endpoints de API detectados
- GET /active-users
- GET /google
- GET /google/callback
- GET /me
- GET /sessions
- POST /logout
- POST /lopdp/accept
- POST /refresh

### Componentes del sistema
- backend\src\modules\auth\auth.controller.js
- backend\src\modules\auth\auth.routes.js

### Componentes frontend relacionados
- spi_front\src\core\api\authApi.js

### Tablas/entidades de datos detectadas
- departments
- user_attendance_records
- user_lopdp_consents
- user_profile
- user_sessions
- users

## 7. Requerimientos funcionales de alto nivel
- REQ-AUTH-001: El sistema debe permitir consultar y listar informacion operativa del modulo Autenticacion segun los permisos del actor.
- REQ-AUTH-002: El sistema debe permitir registrar nuevas operaciones/transacciones del modulo Autenticacion con validaciones de entrada.
- REQ-AUTH-003: El sistema debe interoperar con integraciones externas del modulo Autenticacion: Eventos en tiempo real, Generacion documental PDF, Google OAuth/Drive.
- REQ-AUTH-004: [Funcionalidad detectada en el sistema] El modulo Autenticacion incluye logica interna adicional en servicios/controladores no expuesta completamente por contratos funcionales formales.
- REQ-AUTH-005: El sistema debe garantizar ejecucion consistente de la logica de negocio del modulo Autenticacion en escenarios nominales y de error.

## 8. Requerimientos no funcionales
- RNF-AUTH-001: El modulo debe aplicar control de acceso por autenticacion y autorizacion acorde a la sensibilidad del proceso.
- RNF-AUTH-002: El modulo debe mantener integridad de datos en operaciones de escritura, con manejo transaccional cuando aplique.
- RNF-AUTH-003: El modulo debe registrar trazabilidad/auditoria de acciones criticas para soporte de control interno.
- RNF-AUTH-004: El modulo debe gestionar errores de forma estandarizada, devolviendo codigos y mensajes tecnicos consumibles por frontend.
- RNF-AUTH-005: El modulo debe proteger datos sensibles en transito y en almacenamiento, segun politicas de seguridad del sistema.
- RNF-AUTH-006: El modulo debe sostener rendimiento operativo en consultas y operaciones frecuentes del proceso.
- RNF-AUTH-007: El modulo debe soportar disponibilidad operativa para jornadas internas y continuidad de procesos.
- RNF-AUTH-008: El modulo debe ser mantenible, con separacion clara de rutas, controladores y servicios en el codigo actual.

## 9. Reglas de negocio
- RN-AUTH-001: Solo los roles autorizados pueden ejecutar operaciones sensibles del modulo: gerencia, ti.
- RN-AUTH-002: Las operaciones del modulo deben persistir informacion en las tablas asociadas manteniendo consistencia de datos.
- RN-AUTH-003: Las integraciones externas del modulo deben ejecutarse con tolerancia a fallos y trazabilidad de incidencias.
- RN-AUTH-004: [Funcionalidad detectada en el sistema] Se identifican reglas implicitas implementadas en servicios/controladores que deben formalizarse en el FRS.

## 10. Dependencias con otros modulos
- Notificaciones
- Integraciones externas detectadas: Eventos en tiempo real, Generacion documental PDF, Google OAuth/Drive.

