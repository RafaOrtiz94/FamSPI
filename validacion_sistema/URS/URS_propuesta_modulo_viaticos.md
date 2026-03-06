# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Viaticos

## 1. Introduccion
Este documento presenta la propuesta de requerimientos del modulo Viaticos del Sistema de Procesos Internos SPI, elaborada mediante ingenieria inversa del codigo fuente vigente.

## 2. Objetivo del modulo
Definir y controlar las capacidades funcionales que el sistema debe ofrecer en el ambito de Viaticos para soportar procesos internos del negocio.

## 3. Alcance funcional
- Gestion de capacidades de negocio implementadas en el modulo Viaticos.
- Ejecucion de flujos CRUD/transaccionales soportados por rutas y servicios actuales.
- Consumo de componentes frontend vinculados y contratos API del backend.
- Aplicacion de controles de seguridad, validacion y trazabilidad detectados en el codigo.

## 4. Actores del sistema
- Backoffice Comercial
- Comercial
- Finanzas
- Servicio Tecnico
- Servicios/integraciones externas del modulo
- Tecnico
- Usuario autenticado del proceso interno

## 5. Descripcion general del modulo
El modulo Viaticos se implementa principalmente en backend/src/modules/viaticos y se integra con la arquitectura API del sistema mediante rutas, controladores y servicios. Su comportamiento funcional actual se apoya en validaciones de entrada, control de permisos y trazabilidad operativa.

## 6. Funcionalidades identificadas
- Operacion API detectada: GET /.
- Operacion API detectada: GET /:id/documents.
- Operacion API detectada: GET /:id/report.
- Operacion API detectada: GET /candidates.
- Operacion API detectada: PATCH /:id/status.
- Operacion API detectada: POST /.
- Operacion API detectada: POST /:id/documents.
- [Funcionalidad detectada en el sistema] Persistencia/transaccion sobre tablas: client_requests, client_visit_logs, client_visits, pg_constraint, prospect_visits, source_constraint_name, status_constraint_name, travel_allowance_documents, travel_allowances, user_attendance_records, users.

### Endpoints de API detectados
- GET /
- GET /:id/documents
- GET /:id/report
- GET /candidates
- PATCH /:id/status
- POST /
- POST /:id/documents

### Componentes del sistema
- backend\src\modules\viaticos\viaticos.controller.js
- backend\src\modules\viaticos\viaticos.routes.js
- backend\src\modules\viaticos\viaticos.service.js

### Componentes frontend relacionados
- spi_front\src\core\api\viaticosApi.js

### Tablas/entidades de datos detectadas
- client_requests
- client_visit_logs
- client_visits
- pg_constraint
- prospect_visits
- source_constraint_name
- status_constraint_name
- travel_allowance_documents
- travel_allowances
- user_attendance_records
- users

## 7. Requerimientos funcionales de alto nivel
- REQ-VIAT-001: El sistema debe permitir consultar y listar informacion operativa del modulo Viaticos segun los permisos del actor.
- REQ-VIAT-002: El sistema debe permitir registrar nuevas operaciones/transacciones del modulo Viaticos con validaciones de entrada.
- REQ-VIAT-003: El sistema debe permitir actualizar datos y estados del modulo Viaticos preservando trazabilidad.
- REQ-VIAT-004: El sistema debe controlar cambios de estado/aprobacion del proceso en Viaticos segun reglas y roles definidos.
- REQ-VIAT-005: El sistema debe permitir gestionar evidencia documental asociada al modulo Viaticos, incluyendo carga y consulta.
- REQ-VIAT-006: El sistema debe permitir generar salidas de control (reportes, resumenes o metricas) para seguimiento del modulo Viaticos.
- REQ-VIAT-007: El sistema debe interoperar con integraciones externas del modulo Viaticos: Eventos en tiempo real, Generacion documental PDF, Google OAuth/Drive.

## 8. Requerimientos no funcionales
- RNF-VIAT-001: El modulo debe aplicar control de acceso por autenticacion y autorizacion acorde a la sensibilidad del proceso.
- RNF-VIAT-002: El modulo debe mantener integridad de datos en operaciones de escritura, con manejo transaccional cuando aplique.
- RNF-VIAT-003: El modulo debe registrar trazabilidad/auditoria de acciones criticas para soporte de control interno.
- RNF-VIAT-004: El modulo debe gestionar errores de forma estandarizada, devolviendo codigos y mensajes tecnicos consumibles por frontend.
- RNF-VIAT-005: El modulo debe proteger datos sensibles en transito y en almacenamiento, segun politicas de seguridad del sistema.
- RNF-VIAT-006: El modulo debe sostener rendimiento operativo en consultas y operaciones frecuentes del proceso.
- RNF-VIAT-007: El modulo debe soportar disponibilidad operativa para jornadas internas y continuidad de procesos.
- RNF-VIAT-008: El modulo debe ser mantenible, con separacion clara de rutas, controladores y servicios en el codigo actual.

## 9. Reglas de negocio
- RN-VIAT-001: Solo los roles autorizados pueden ejecutar operaciones sensibles del modulo: backoffice_comercial, comercial, finanzas, servicio_tecnico, tecnico.
- RN-VIAT-002: Los cambios de estado deben respetar la secuencia de negocio definida por la logica actual del modulo.
- RN-VIAT-003: Las operaciones del modulo deben persistir informacion en las tablas asociadas manteniendo consistencia de datos.
- RN-VIAT-004: Las integraciones externas del modulo deben ejecutarse con tolerancia a fallos y trazabilidad de incidencias.
- RN-VIAT-005: [Funcionalidad detectada en el sistema] Se identifican reglas implicitas implementadas en servicios/controladores que deben formalizarse en el FRS.

## 10. Dependencias con otros modulos
- El modulo opera con acoplamiento interno minimo; no se detectaron dependencias directas explicitas hacia otros modulos de negocio.
- Integraciones externas detectadas: Eventos en tiempo real, Generacion documental PDF, Google OAuth/Drive.

