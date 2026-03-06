# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Aprobaciones

## 1. Introduccion
Este documento presenta la propuesta de requerimientos del modulo Aprobaciones del Sistema de Procesos Internos SPI, elaborada mediante ingenieria inversa del codigo fuente vigente.

## 2. Objetivo del modulo
Definir y controlar las capacidades funcionales que el sistema debe ofrecer en el ambito de Aprobaciones para soportar procesos internos del negocio.

## 3. Alcance funcional
- Gestion de capacidades de negocio implementadas en el modulo Aprobaciones.
- Ejecucion de flujos CRUD/transaccionales soportados por rutas y servicios actuales.
- Consumo de componentes frontend vinculados y contratos API del backend.
- Aplicacion de controles de seguridad, validacion y trazabilidad detectados en el codigo.

## 4. Actores del sistema
- Calidad
- Gerencia
- Jefe Calidad
- Jefe Servicio Tecnico
- Jefe Tecnico
- Servicios/integraciones externas del modulo
- Tecnico
- Usuario autenticado del proceso interno

## 5. Descripcion general del modulo
El modulo Aprobaciones se implementa principalmente en backend/src/modules/approvals y se integra con la arquitectura API del sistema mediante rutas, controladores y servicios. Su comportamiento funcional actual se apoya en validaciones de entrada, control de permisos y trazabilidad operativa.

## 6. Funcionalidades identificadas
- Operacion API detectada: GET /pending.
- Operacion API detectada: POST /:id/approve.
- Operacion API detectada: POST /:id/reject.
- [Funcionalidad detectada en el sistema] Persistencia/transaccion sobre tablas: request_approvals, request_types, requests, users.

### Endpoints de API detectados
- GET /pending
- POST /:id/approve
- POST /:id/reject

### Componentes del sistema
- backend\src\modules\approvals\approvals.controller.js
- backend\src\modules\approvals\approvals.routes.js
- backend\src\modules\approvals\approvals.service.js

### Componentes frontend relacionados
- spi_front\src\core\api\approvalsApi.js

### Tablas/entidades de datos detectadas
- request_approvals
- request_types
- requests
- users

## 7. Requerimientos funcionales de alto nivel
- REQ-APPR-001: El sistema debe permitir consultar y listar informacion operativa del modulo Aprobaciones segun los permisos del actor.
- REQ-APPR-002: El sistema debe permitir registrar nuevas operaciones/transacciones del modulo Aprobaciones con validaciones de entrada.
- REQ-APPR-003: El sistema debe controlar cambios de estado/aprobacion del proceso en Aprobaciones segun reglas y roles definidos.
- REQ-APPR-004: El sistema debe interoperar con integraciones externas del modulo Aprobaciones: Correo corporativo, Eventos en tiempo real.
- REQ-APPR-005: [Funcionalidad detectada en el sistema] El modulo Aprobaciones incluye logica interna adicional en servicios/controladores no expuesta completamente por contratos funcionales formales.
- REQ-APPR-006: El sistema debe garantizar ejecucion consistente de la logica de negocio del modulo Aprobaciones en escenarios nominales y de error.

## 8. Requerimientos no funcionales
- RNF-APPR-001: El modulo debe aplicar control de acceso por autenticacion y autorizacion acorde a la sensibilidad del proceso.
- RNF-APPR-002: El modulo debe mantener integridad de datos en operaciones de escritura, con manejo transaccional cuando aplique.
- RNF-APPR-003: El modulo debe registrar trazabilidad/auditoria de acciones criticas para soporte de control interno.
- RNF-APPR-004: El modulo debe gestionar errores de forma estandarizada, devolviendo codigos y mensajes tecnicos consumibles por frontend.
- RNF-APPR-005: El modulo debe proteger datos sensibles en transito y en almacenamiento, segun politicas de seguridad del sistema.
- RNF-APPR-006: El modulo debe sostener rendimiento operativo en consultas y operaciones frecuentes del proceso.
- RNF-APPR-007: El modulo debe soportar disponibilidad operativa para jornadas internas y continuidad de procesos.
- RNF-APPR-008: El modulo debe ser mantenible, con separacion clara de rutas, controladores y servicios en el codigo actual.

## 9. Reglas de negocio
- RN-APPR-001: Solo los roles autorizados pueden ejecutar operaciones sensibles del modulo: calidad, gerencia, jefe_calidad, jefe_servicio_tecnico, jefe_tecnico, tecnico.
- RN-APPR-002: Los cambios de estado deben respetar la secuencia de negocio definida por la logica actual del modulo.
- RN-APPR-003: Las operaciones del modulo deben persistir informacion en las tablas asociadas manteniendo consistencia de datos.
- RN-APPR-004: Las integraciones externas del modulo deben ejecutarse con tolerancia a fallos y trazabilidad de incidencias.
- RN-APPR-005: [Funcionalidad detectada en el sistema] Se identifican reglas implicitas implementadas en servicios/controladores que deben formalizarse en el FRS.

## 10. Dependencias con otros modulos
- Solicitudes
- Integraciones externas detectadas: Correo corporativo, Eventos en tiempo real.

