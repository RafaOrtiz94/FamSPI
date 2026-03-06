# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Firma Documental

## 1. Introduccion
Este documento presenta la propuesta de requerimientos del modulo Firma Documental del Sistema de Procesos Internos SPI, elaborada mediante ingenieria inversa del codigo fuente vigente.

## 2. Objetivo del modulo
Definir y controlar las capacidades funcionales que el sistema debe ofrecer en el ambito de Firma Documental para soportar procesos internos del negocio.

## 3. Alcance funcional
- Gestion de capacidades de negocio implementadas en el modulo Firma Documental.
- Ejecucion de flujos CRUD/transaccionales soportados por rutas y servicios actuales.
- Consumo de componentes frontend vinculados y contratos API del backend.
- Aplicacion de controles de seguridad, validacion y trazabilidad detectados en el codigo.

## 4. Actores del sistema
- Servicios/integraciones externas del modulo
- Usuario autenticado del proceso interno

## 5. Descripcion general del modulo
El modulo Firma Documental se implementa principalmente en backend/src/modules/signature y se integra con la arquitectura API del sistema mediante rutas, controladores y servicios. Su comportamiento funcional actual se apoya en validaciones de entrada, control de permisos y trazabilidad operativa.

## 6. Funcionalidades identificadas
- Operacion API detectada: GET /dashboard.
- Operacion API detectada: GET /documents/:documentId/audit-trail.
- Operacion API detectada: GET /verificar/:token.
- Operacion API detectada: GET /verify/:token.
- Operacion API detectada: POST /documents/:documentId/sign.
- [Funcionalidad detectada en el sistema] Persistencia/transaccion sobre tablas: create_document_seal_and_qr, document_hashes, document_qr_codes, document_seals, document_signature_logs, document_signatures_advanced, document_verification_info, documents, get_document_audit_trail.

### Endpoints de API detectados
- GET /dashboard
- GET /documents/:documentId/audit-trail
- GET /verificar/:token
- GET /verify/:token
- POST /documents/:documentId/sign

### Componentes del sistema
- backend\src\modules\signature\signature.controller.js
- backend\src\modules\signature\signature.routes.js

### Componentes frontend relacionados
- spi_front\src\core\api\signatureApi.js

### Tablas/entidades de datos detectadas
- create_document_seal_and_qr
- document_hashes
- document_qr_codes
- document_seals
- document_signature_logs
- document_signatures_advanced
- document_verification_info
- documents
- get_document_audit_trail

## 7. Requerimientos funcionales de alto nivel
- REQ-SIGN-001: El sistema debe permitir consultar y listar informacion operativa del modulo Firma Documental segun los permisos del actor.
- REQ-SIGN-002: El sistema debe permitir registrar nuevas operaciones/transacciones del modulo Firma Documental con validaciones de entrada.
- REQ-SIGN-003: El sistema debe permitir gestionar evidencia documental asociada al modulo Firma Documental, incluyendo carga y consulta.
- REQ-SIGN-004: El sistema debe interoperar con integraciones externas del modulo Firma Documental: Eventos en tiempo real, Generacion documental PDF, Google OAuth/Drive.
- REQ-SIGN-005: [Funcionalidad detectada en el sistema] El modulo Firma Documental incluye logica interna adicional en servicios/controladores no expuesta completamente por contratos funcionales formales.
- REQ-SIGN-006: El sistema debe garantizar ejecucion consistente de la logica de negocio del modulo Firma Documental en escenarios nominales y de error.

## 8. Requerimientos no funcionales
- RNF-SIGN-001: El modulo debe aplicar control de acceso por autenticacion y autorizacion acorde a la sensibilidad del proceso.
- RNF-SIGN-002: El modulo debe mantener integridad de datos en operaciones de escritura, con manejo transaccional cuando aplique.
- RNF-SIGN-003: El modulo debe registrar trazabilidad/auditoria de acciones criticas para soporte de control interno.
- RNF-SIGN-004: El modulo debe gestionar errores de forma estandarizada, devolviendo codigos y mensajes tecnicos consumibles por frontend.
- RNF-SIGN-005: El modulo debe proteger datos sensibles en transito y en almacenamiento, segun politicas de seguridad del sistema.
- RNF-SIGN-006: El modulo debe sostener rendimiento operativo en consultas y operaciones frecuentes del proceso.
- RNF-SIGN-007: El modulo debe soportar disponibilidad operativa para jornadas internas y continuidad de procesos.
- RNF-SIGN-008: El modulo debe ser mantenible, con separacion clara de rutas, controladores y servicios en el codigo actual.

## 9. Reglas de negocio
- RN-SIGN-001: Las operaciones del modulo deben ejecutarse solo por actores autenticados con permisos efectivos del contexto.
- RN-SIGN-002: Las operaciones del modulo deben persistir informacion en las tablas asociadas manteniendo consistencia de datos.
- RN-SIGN-003: Las integraciones externas del modulo deben ejecutarse con tolerancia a fallos y trazabilidad de incidencias.
- RN-SIGN-004: [Funcionalidad detectada en el sistema] Se identifican reglas implicitas implementadas en servicios/controladores que deben formalizarse en el FRS.

## 10. Dependencias con otros modulos
- El modulo opera con acoplamiento interno minimo; no se detectaron dependencias directas explicitas hacia otros modulos de negocio.
- Integraciones externas detectadas: Eventos en tiempo real, Generacion documental PDF, Google OAuth/Drive.

