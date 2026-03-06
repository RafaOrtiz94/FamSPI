# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Clientes

## 1. Introduccion
Este documento presenta la propuesta de requerimientos del modulo Clientes del Sistema de Procesos Internos SPI, elaborada mediante ingenieria inversa del codigo fuente vigente.

## 2. Objetivo del modulo
Definir y controlar las capacidades funcionales que el sistema debe ofrecer en el ambito de Clientes para soportar procesos internos del negocio.

## 3. Alcance funcional
- Gestion de capacidades de negocio implementadas en el modulo Clientes.
- Ejecucion de flujos CRUD/transaccionales soportados por rutas y servicios actuales.
- Consumo de componentes frontend vinculados y contratos API del backend.
- Aplicacion de controles de seguridad, validacion y trazabilidad detectados en el codigo.

## 4. Actores del sistema
- Acp Comercial
- Admin
- Administrador
- Backoffice
- Backoffice Comercial
- Comercial
- Gerencia
- Gerente
- Jefe Comercial
- Servicios/integraciones externas del modulo

## 5. Descripcion general del modulo
El modulo Clientes se implementa principalmente en backend/src/modules/clients y se integra con la arquitectura API del sistema mediante rutas, controladores y servicios. Su comportamiento funcional actual se apoya en validaciones de entrada, control de permisos y trazabilidad operativa.

## 6. Funcionalidades identificadas
- Operacion API detectada: GET /.
- Operacion API detectada: GET /:id.
- Operacion API detectada: POST /:id/assign.
- Operacion API detectada: POST /:id/visit-status.
- Operacion API detectada: POST /prospect-visit.
- Operacion API detectada: PUT /:id.
- [Funcionalidad detectada en el sistema] Persistencia/transaccion sobre tablas: client_assignments, client_requests, client_visit_logs, pg_constraint, prospect_visits, scheduled_visits, users.

### Endpoints de API detectados
- GET /
- GET /:id
- POST /:id/assign
- POST /:id/visit-status
- POST /prospect-visit
- PUT /:id

### Componentes del sistema
- backend\src\modules\clients\clients.controller.js
- backend\src\modules\clients\clients.routes.js
- backend\src\modules\clients\clients.service.js

### Componentes frontend relacionados
- spi_front\src\core\api\clientsApi.js

### Tablas/entidades de datos detectadas
- client_assignments
- client_requests
- client_visit_logs
- pg_constraint
- prospect_visits
- scheduled_visits
- users

## 7. Requerimientos funcionales de alto nivel
- REQ-CLIE-001: El sistema debe permitir consultar y listar informacion operativa del modulo Clientes segun los permisos del actor.
- REQ-CLIE-002: El sistema debe permitir registrar nuevas operaciones/transacciones del modulo Clientes con validaciones de entrada.
- REQ-CLIE-003: El sistema debe permitir actualizar datos y estados del modulo Clientes preservando trazabilidad.
- REQ-CLIE-004: El sistema debe controlar cambios de estado/aprobacion del proceso en Clientes segun reglas y roles definidos.
- REQ-CLIE-005: El sistema debe interoperar con integraciones externas del modulo Clientes: Eventos en tiempo real, Generacion documental PDF, Google OAuth/Drive.

## 8. Requerimientos no funcionales
- RNF-CLIE-001: El modulo debe aplicar control de acceso por autenticacion y autorizacion acorde a la sensibilidad del proceso.
- RNF-CLIE-002: El modulo debe mantener integridad de datos en operaciones de escritura, con manejo transaccional cuando aplique.
- RNF-CLIE-003: El modulo debe registrar trazabilidad/auditoria de acciones criticas para soporte de control interno.
- RNF-CLIE-004: El modulo debe gestionar errores de forma estandarizada, devolviendo codigos y mensajes tecnicos consumibles por frontend.
- RNF-CLIE-005: El modulo debe proteger datos sensibles en transito y en almacenamiento, segun politicas de seguridad del sistema.
- RNF-CLIE-006: El modulo debe sostener rendimiento operativo en consultas y operaciones frecuentes del proceso.
- RNF-CLIE-007: El modulo debe soportar disponibilidad operativa para jornadas internas y continuidad de procesos.
- RNF-CLIE-008: El modulo debe ser mantenible, con separacion clara de rutas, controladores y servicios en el codigo actual.

## 9. Reglas de negocio
- RN-CLIE-001: Solo los roles autorizados pueden ejecutar operaciones sensibles del modulo: acp_comercial, admin, administrador, backoffice, backoffice_comercial, comercial, gerencia, gerente, jefe_comercial, ti.
- RN-CLIE-002: Los cambios de estado deben respetar la secuencia de negocio definida por la logica actual del modulo.
- RN-CLIE-003: Las operaciones del modulo deben persistir informacion en las tablas asociadas manteniendo consistencia de datos.
- RN-CLIE-004: Las integraciones externas del modulo deben ejecutarse con tolerancia a fallos y trazabilidad de incidencias.
- RN-CLIE-005: [Funcionalidad detectada en el sistema] Se identifican reglas implicitas implementadas en servicios/controladores que deben formalizarse en el FRS.

## 10. Dependencias con otros modulos
- Cronogramas
- Integraciones externas detectadas: Eventos en tiempo real, Generacion documental PDF, Google OAuth/Drive.

