# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Postulantes

## 1. Introduccion
Este documento presenta la propuesta de requerimientos del modulo Postulantes del Sistema de Procesos Internos SPI, elaborada mediante ingenieria inversa del codigo fuente vigente.

## 2. Objetivo del modulo
Definir y controlar las capacidades funcionales que el sistema debe ofrecer en el ambito de Postulantes para soportar procesos internos del negocio.

## 3. Alcance funcional
- Gestion de capacidades de negocio implementadas en el modulo Postulantes.
- Ejecucion de flujos CRUD/transaccionales soportados por rutas y servicios actuales.
- Consumo de componentes frontend vinculados y contratos API del backend.
- Aplicacion de controles de seguridad, validacion y trazabilidad detectados en el codigo.

## 4. Actores del sistema
- Servicios/integraciones externas del modulo
- Usuario autenticado del proceso interno

## 5. Descripcion general del modulo
El modulo Postulantes se implementa principalmente en backend/src/modules/applicants y se integra con la arquitectura API del sistema mediante rutas, controladores y servicios. Su comportamiento funcional actual se apoya en validaciones de entrada, control de permisos y trazabilidad operativa.

## 6. Funcionalidades identificadas
- Operacion API detectada: GET /.
- Operacion API detectada: GET /:id.
- Operacion API detectada: POST /import.
- [Funcionalidad detectada en el sistema] Persistencia/transaccion sobre tablas: applicant_documents, applicant_education, applicant_ethnic_id, applicant_health, applicant_licenses, applicant_personal_data, applicant_personal_references, applicant_trainings, applicant_work_experience, applicant_work_references, applicants, updated.

### Endpoints de API detectados
- GET /
- GET /:id
- POST /import

### Componentes del sistema
- backend\src\modules\applicants\applicants.controller.js
- backend\src\modules\applicants\applicants.routes.js
- backend\src\modules\applicants\applicants.service.js

### Componentes frontend relacionados
- spi_front\src\core\api\applicantsApi.js

### Tablas/entidades de datos detectadas
- applicant_documents
- applicant_education
- applicant_ethnic_id
- applicant_health
- applicant_licenses
- applicant_personal_data
- applicant_personal_references
- applicant_trainings
- applicant_work_experience
- applicant_work_references
- applicants
- updated

## 7. Requerimientos funcionales de alto nivel
- REQ-APPL-001: El sistema debe permitir consultar y listar informacion operativa del modulo Postulantes segun los permisos del actor.
- REQ-APPL-002: El sistema debe permitir registrar nuevas operaciones/transacciones del modulo Postulantes con validaciones de entrada.
- REQ-APPL-003: El sistema debe interoperar con integraciones externas del modulo Postulantes: Eventos en tiempo real, Generacion documental PDF, Google OAuth/Drive.
- REQ-APPL-004: [Funcionalidad detectada en el sistema] El modulo Postulantes incluye logica interna adicional en servicios/controladores no expuesta completamente por contratos funcionales formales.
- REQ-APPL-005: El sistema debe garantizar ejecucion consistente de la logica de negocio del modulo Postulantes en escenarios nominales y de error.

## 8. Requerimientos no funcionales
- RNF-APPL-001: El modulo debe aplicar control de acceso por autenticacion y autorizacion acorde a la sensibilidad del proceso.
- RNF-APPL-002: El modulo debe mantener integridad de datos en operaciones de escritura, con manejo transaccional cuando aplique.
- RNF-APPL-003: El modulo debe registrar trazabilidad/auditoria de acciones criticas para soporte de control interno.
- RNF-APPL-004: El modulo debe gestionar errores de forma estandarizada, devolviendo codigos y mensajes tecnicos consumibles por frontend.
- RNF-APPL-005: El modulo debe proteger datos sensibles en transito y en almacenamiento, segun politicas de seguridad del sistema.
- RNF-APPL-006: El modulo debe sostener rendimiento operativo en consultas y operaciones frecuentes del proceso.
- RNF-APPL-007: El modulo debe soportar disponibilidad operativa para jornadas internas y continuidad de procesos.
- RNF-APPL-008: El modulo debe ser mantenible, con separacion clara de rutas, controladores y servicios en el codigo actual.

## 9. Reglas de negocio
- RN-APPL-001: Las operaciones del modulo deben ejecutarse solo por actores autenticados con permisos efectivos del contexto.
- RN-APPL-002: Las operaciones del modulo deben persistir informacion en las tablas asociadas manteniendo consistencia de datos.
- RN-APPL-003: Las integraciones externas del modulo deben ejecutarse con tolerancia a fallos y trazabilidad de incidencias.
- RN-APPL-004: [Funcionalidad detectada en el sistema] Se identifican reglas implicitas implementadas en servicios/controladores que deben formalizarse en el FRS.

## 10. Dependencias con otros modulos
- El modulo opera con acoplamiento interno minimo; no se detectaron dependencias directas explicitas hacia otros modulos de negocio.
- Integraciones externas detectadas: Eventos en tiempo real, Generacion documental PDF, Google OAuth/Drive.

