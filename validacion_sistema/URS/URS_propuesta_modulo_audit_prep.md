# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Preparacion de Auditoria

## 1. Introduccion
Este documento presenta la propuesta de requerimientos del modulo Preparacion de Auditoria del Sistema de Procesos Internos SPI, elaborada mediante ingenieria inversa del codigo fuente vigente.

## 2. Objetivo del modulo
Definir y controlar las capacidades funcionales que el sistema debe ofrecer en el ambito de Preparacion de Auditoria para soportar procesos internos del negocio.

## 3. Alcance funcional
- Gestion de capacidades de negocio implementadas en el modulo Preparacion de Auditoria.
- Ejecucion de flujos CRUD/transaccionales soportados por rutas y servicios actuales.
- Consumo de componentes frontend vinculados y contratos API del backend.
- Aplicacion de controles de seguridad, validacion y trazabilidad detectados en el codigo.

## 4. Actores del sistema
- Admin Ti
- Jefe Ti
- Servicios/integraciones externas del modulo
- Usuario autenticado del proceso interno

## 5. Descripcion general del modulo
El modulo Preparacion de Auditoria se implementa principalmente en backend/src/modules/audit-prep y se integra con la arquitectura API del sistema mediante rutas, controladores y servicios. Su comportamiento funcional actual se apoya en validaciones de entrada, control de permisos y trazabilidad operativa.

## 6. Funcionalidades identificadas
- Operacion API detectada: DELETE /external-access/:id.
- Operacion API detectada: GET /documents.
- Operacion API detectada: GET /documents/:id/download.
- Operacion API detectada: GET /external-access.
- Operacion API detectada: GET /sections.
- Operacion API detectada: GET /status.
- Operacion API detectada: PATCH /documents/:id/status.
- Operacion API detectada: POST /documents/upload.
- Operacion API detectada: POST /external-access.
- Operacion API detectada: POST /sections.
- Operacion API detectada: PUT /status.
- [Funcionalidad detectada en el sistema] Persistencia/transaccion sobre tablas: audit_access_grants, audit_documents, audit_sections, audit_settings, users.

### Endpoints de API detectados
- DELETE /external-access/:id
- GET /documents
- GET /documents/:id/download
- GET /external-access
- GET /sections
- GET /status
- PATCH /documents/:id/status
- POST /documents/upload
- POST /external-access
- POST /sections
- PUT /status

### Componentes del sistema
- backend\src\modules\audit-prep\auditPrep.controller.js
- backend\src\modules\audit-prep\auditPrep.routes.js
- backend\src\modules\audit-prep\auditPrep.service.js

### Componentes frontend relacionados
- spi_front\src\core\api\auditPrepApi.js

### Tablas/entidades de datos detectadas
- audit_access_grants
- audit_documents
- audit_sections
- audit_settings
- users

## 7. Requerimientos funcionales de alto nivel
- REQ-AUPR-001: El sistema debe permitir consultar y listar informacion operativa del modulo Preparacion de Auditoria segun los permisos del actor.
- REQ-AUPR-002: El sistema debe permitir registrar nuevas operaciones/transacciones del modulo Preparacion de Auditoria con validaciones de entrada.
- REQ-AUPR-003: El sistema debe permitir actualizar datos y estados del modulo Preparacion de Auditoria preservando trazabilidad.
- REQ-AUPR-004: El sistema debe permitir ejecutar eliminaciones controladas del modulo Preparacion de Auditoria cuando el flujo de negocio lo permita.
- REQ-AUPR-005: El sistema debe controlar cambios de estado/aprobacion del proceso en Preparacion de Auditoria segun reglas y roles definidos.
- REQ-AUPR-006: El sistema debe permitir gestionar evidencia documental asociada al modulo Preparacion de Auditoria, incluyendo carga y consulta.
- REQ-AUPR-007: El sistema debe interoperar con integraciones externas del modulo Preparacion de Auditoria: Eventos en tiempo real, Generacion documental PDF, Google OAuth/Drive.

## 8. Requerimientos no funcionales
- RNF-AUPR-001: El modulo debe aplicar control de acceso por autenticacion y autorizacion acorde a la sensibilidad del proceso.
- RNF-AUPR-002: El modulo debe mantener integridad de datos en operaciones de escritura, con manejo transaccional cuando aplique.
- RNF-AUPR-003: El modulo debe registrar trazabilidad/auditoria de acciones criticas para soporte de control interno.
- RNF-AUPR-004: El modulo debe gestionar errores de forma estandarizada, devolviendo codigos y mensajes tecnicos consumibles por frontend.
- RNF-AUPR-005: El modulo debe proteger datos sensibles en transito y en almacenamiento, segun politicas de seguridad del sistema.
- RNF-AUPR-006: El modulo debe sostener rendimiento operativo en consultas y operaciones frecuentes del proceso.
- RNF-AUPR-007: El modulo debe soportar disponibilidad operativa para jornadas internas y continuidad de procesos.
- RNF-AUPR-008: El modulo debe ser mantenible, con separacion clara de rutas, controladores y servicios en el codigo actual.

## 9. Reglas de negocio
- RN-AUPR-001: Solo los roles autorizados pueden ejecutar operaciones sensibles del modulo: admin_ti, jefe_ti.
- RN-AUPR-002: Los cambios de estado deben respetar la secuencia de negocio definida por la logica actual del modulo.
- RN-AUPR-003: Las operaciones del modulo deben persistir informacion en las tablas asociadas manteniendo consistencia de datos.
- RN-AUPR-004: Las integraciones externas del modulo deben ejecutarse con tolerancia a fallos y trazabilidad de incidencias.
- RN-AUPR-005: [Funcionalidad detectada en el sistema] Se identifican reglas implicitas implementadas en servicios/controladores que deben formalizarse en el FRS.

## 10. Dependencias con otros modulos
- El modulo opera con acoplamiento interno minimo; no se detectaron dependencias directas explicitas hacia otros modulos de negocio.
- Integraciones externas detectadas: Eventos en tiempo real, Generacion documental PDF, Google OAuth/Drive.

