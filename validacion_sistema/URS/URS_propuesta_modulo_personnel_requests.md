# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Solicitudes de Personal

## 1. Introduccion
Este documento presenta la propuesta de requerimientos del modulo Solicitudes de Personal del Sistema de Procesos Internos SPI, elaborada mediante ingenieria inversa del codigo fuente vigente.

## 2. Objetivo del modulo
Definir y controlar las capacidades funcionales que el sistema debe ofrecer en el ambito de Solicitudes de Personal para soportar procesos internos del negocio.

## 3. Alcance funcional
- Gestion de capacidades de negocio implementadas en el modulo Solicitudes de Personal.
- Ejecucion de flujos CRUD/transaccionales soportados por rutas y servicios actuales.
- Consumo de componentes frontend vinculados y contratos API del backend.
- Aplicacion de controles de seguridad, validacion y trazabilidad detectados en el codigo.

## 4. Actores del sistema
- Admin
- Gerencia
- Gerencia General
- Gerente
- Jefe Calidad
- Jefe Comercial
- Jefe Finanzas
- Jefe Operaciones
- Jefe Servicio Tecnico
- Jefe Talento Humano

## 5. Descripcion general del modulo
El modulo Solicitudes de Personal se implementa principalmente en backend/src/modules/personnel-requests y se integra con la arquitectura API del sistema mediante rutas, controladores y servicios. Su comportamiento funcional actual se apoya en validaciones de entrada, control de permisos y trazabilidad operativa.

## 6. Funcionalidades identificadas
- Operacion API detectada: GET /.
- Operacion API detectada: GET /:id.
- Operacion API detectada: GET /:id/profile.
- Operacion API detectada: GET /stats.
- Operacion API detectada: PATCH /:id/applicant.
- Operacion API detectada: PATCH /:id/collaborator.
- Operacion API detectada: PATCH /:id/status.
- Operacion API detectada: POST /.
- Operacion API detectada: POST /:id/comments.
- Operacion API detectada: POST /:id/documents.
- Operacion API detectada: POST /:id/hire.
- Operacion API detectada: PUT /:id/profile.
- [Funcionalidad detectada en el sistema] Persistencia/transaccion sobre tablas: applicant_documents, applicants, collaborator_documents, collaborator_profiles, departments, personnel_request_comments, personnel_request_documents, personnel_request_history, personnel_request_profiles, personnel_requests, users.

### Endpoints de API detectados
- GET /
- GET /:id
- GET /:id/profile
- GET /stats
- PATCH /:id/applicant
- PATCH /:id/collaborator
- PATCH /:id/status
- POST /
- POST /:id/comments
- POST /:id/documents
- POST /:id/hire
- PUT /:id/profile

### Componentes del sistema
- backend\src\modules\personnel-requests\personnel-requests.controller.js
- backend\src\modules\personnel-requests\personnel-requests.routes.js
- backend\src\modules\personnel-requests\personnel-requests.service.js

### Componentes frontend relacionados
- spi_front\src\core\api\personnelRequestsApi.js

### Tablas/entidades de datos detectadas
- applicant_documents
- applicants
- collaborator_documents
- collaborator_profiles
- departments
- personnel_request_comments
- personnel_request_documents
- personnel_request_history
- personnel_request_profiles
- personnel_requests
- users

## 7. Requerimientos funcionales de alto nivel
- REQ-PERE-001: El sistema debe permitir consultar y listar informacion operativa del modulo Solicitudes de Personal segun los permisos del actor.
- REQ-PERE-002: El sistema debe permitir registrar nuevas operaciones/transacciones del modulo Solicitudes de Personal con validaciones de entrada.
- REQ-PERE-003: El sistema debe permitir actualizar datos y estados del modulo Solicitudes de Personal preservando trazabilidad.
- REQ-PERE-004: El sistema debe controlar cambios de estado/aprobacion del proceso en Solicitudes de Personal segun reglas y roles definidos.
- REQ-PERE-005: El sistema debe permitir gestionar evidencia documental asociada al modulo Solicitudes de Personal, incluyendo carga y consulta.
- REQ-PERE-006: El sistema debe permitir generar salidas de control (reportes, resumenes o metricas) para seguimiento del modulo Solicitudes de Personal.
- REQ-PERE-007: El sistema debe interoperar con integraciones externas del modulo Solicitudes de Personal: Correo corporativo, Eventos en tiempo real, Generacion documental PDF, Google OAuth/Drive.

## 8. Requerimientos no funcionales
- RNF-PERE-001: El modulo debe aplicar control de acceso por autenticacion y autorizacion acorde a la sensibilidad del proceso.
- RNF-PERE-002: El modulo debe mantener integridad de datos en operaciones de escritura, con manejo transaccional cuando aplique.
- RNF-PERE-003: El modulo debe registrar trazabilidad/auditoria de acciones criticas para soporte de control interno.
- RNF-PERE-004: El modulo debe gestionar errores de forma estandarizada, devolviendo codigos y mensajes tecnicos consumibles por frontend.
- RNF-PERE-005: El modulo debe proteger datos sensibles en transito y en almacenamiento, segun politicas de seguridad del sistema.
- RNF-PERE-006: El modulo debe sostener rendimiento operativo en consultas y operaciones frecuentes del proceso.
- RNF-PERE-007: El modulo debe soportar disponibilidad operativa para jornadas internas y continuidad de procesos.
- RNF-PERE-008: El modulo debe ser mantenible, con separacion clara de rutas, controladores y servicios en el codigo actual.

## 9. Reglas de negocio
- RN-PERE-001: Solo los roles autorizados pueden ejecutar operaciones sensibles del modulo: admin, gerencia, gerencia_general, gerente, jefe_calidad, jefe_comercial, jefe_finanzas, jefe_operaciones, jefe_servicio_tecnico, jefe_talento_humano, jefe_tecnico, talento_humano.
- RN-PERE-002: Los cambios de estado deben respetar la secuencia de negocio definida por la logica actual del modulo.
- RN-PERE-003: Las operaciones del modulo deben persistir informacion en las tablas asociadas manteniendo consistencia de datos.
- RN-PERE-004: Las integraciones externas del modulo deben ejecutarse con tolerancia a fallos y trazabilidad de incidencias.
- RN-PERE-005: [Funcionalidad detectada en el sistema] Se identifican reglas implicitas implementadas en servicios/controladores que deben formalizarse en el FRS.

## 10. Dependencias con otros modulos
- Notificaciones
- Postulantes
- Integraciones externas detectadas: Correo corporativo, Eventos en tiempo real, Generacion documental PDF, Google OAuth/Drive.

