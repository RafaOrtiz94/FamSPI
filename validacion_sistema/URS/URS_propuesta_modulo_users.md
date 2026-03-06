# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Usuarios

## 1. Introduccion
Este documento presenta la propuesta de requerimientos del modulo Usuarios del Sistema de Procesos Internos SPI, elaborada mediante ingenieria inversa del codigo fuente vigente.

## 2. Objetivo del modulo
Definir y controlar las capacidades funcionales que el sistema debe ofrecer en el ambito de Usuarios para soportar procesos internos del negocio.

## 3. Alcance funcional
- Gestion de capacidades de negocio implementadas en el modulo Usuarios.
- Ejecucion de flujos CRUD/transaccionales soportados por rutas y servicios actuales.
- Consumo de componentes frontend vinculados y contratos API del backend.
- Aplicacion de controles de seguridad, validacion y trazabilidad detectados en el codigo.

## 4. Actores del sistema
- Servicios/integraciones externas del modulo
- Usuario autenticado del proceso interno

## 5. Descripcion general del modulo
El modulo Usuarios se implementa principalmente en backend/src/modules/users y se integra con la arquitectura API del sistema mediante rutas, controladores y servicios. Su comportamiento funcional actual se apoya en validaciones de entrada, control de permisos y trazabilidad operativa.

## 6. Funcionalidades identificadas
- Operacion API detectada: DELETE /:id.
- Operacion API detectada: GET /.
- Operacion API detectada: GET /:id.
- Operacion API detectada: POST /.
- Operacion API detectada: PUT /:id.
- [Funcionalidad detectada en el sistema] Persistencia/transaccion sobre tablas: departments, document_signatures, inventory_movements, request_approvals, request_attachments, request_status_history, request_versions, requests, users.

### Endpoints de API detectados
- DELETE /:id
- GET /
- GET /:id
- POST /
- PUT /:id

### Componentes del sistema
- backend\src\modules\users\users.controller.js
- backend\src\modules\users\users.routes.js

### Componentes frontend relacionados
- spi_front\src\core\api\usersApi.js

### Tablas/entidades de datos detectadas
- departments
- document_signatures
- inventory_movements
- request_approvals
- request_attachments
- request_status_history
- request_versions
- requests
- users

## 7. Requerimientos funcionales de alto nivel
- REQ-USER-001: El sistema debe permitir consultar y listar informacion operativa del modulo Usuarios segun los permisos del actor.
- REQ-USER-002: El sistema debe permitir registrar nuevas operaciones/transacciones del modulo Usuarios con validaciones de entrada.
- REQ-USER-003: El sistema debe permitir actualizar datos y estados del modulo Usuarios preservando trazabilidad.
- REQ-USER-004: El sistema debe permitir ejecutar eliminaciones controladas del modulo Usuarios cuando el flujo de negocio lo permita.
- REQ-USER-005: El sistema debe interoperar con integraciones externas del modulo Usuarios: Google OAuth/Drive.

## 8. Requerimientos no funcionales
- RNF-USER-001: El modulo debe aplicar control de acceso por autenticacion y autorizacion acorde a la sensibilidad del proceso.
- RNF-USER-002: El modulo debe mantener integridad de datos en operaciones de escritura, con manejo transaccional cuando aplique.
- RNF-USER-003: El modulo debe registrar trazabilidad/auditoria de acciones criticas para soporte de control interno.
- RNF-USER-004: El modulo debe gestionar errores de forma estandarizada, devolviendo codigos y mensajes tecnicos consumibles por frontend.
- RNF-USER-005: El modulo debe proteger datos sensibles en transito y en almacenamiento, segun politicas de seguridad del sistema.
- RNF-USER-006: El modulo debe sostener rendimiento operativo en consultas y operaciones frecuentes del proceso.
- RNF-USER-007: El modulo debe soportar disponibilidad operativa para jornadas internas y continuidad de procesos.
- RNF-USER-008: El modulo debe ser mantenible, con separacion clara de rutas, controladores y servicios en el codigo actual.

## 9. Reglas de negocio
- RN-USER-001: Las operaciones del modulo deben ejecutarse solo por actores autenticados con permisos efectivos del contexto.
- RN-USER-002: Las operaciones del modulo deben persistir informacion en las tablas asociadas manteniendo consistencia de datos.
- RN-USER-003: Las integraciones externas del modulo deben ejecutarse con tolerancia a fallos y trazabilidad de incidencias.
- RN-USER-004: [Funcionalidad detectada en el sistema] Se identifican reglas implicitas implementadas en servicios/controladores que deben formalizarse en el FRS.

## 10. Dependencias con otros modulos
- El modulo opera con acoplamiento interno minimo; no se detectaron dependencias directas explicitas hacia otros modulos de negocio.
- Integraciones externas detectadas: Google OAuth/Drive.

