# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Documentos

## 1. Introduccion
Este documento presenta la propuesta de requerimientos del modulo Documentos del Sistema de Procesos Internos SPI, elaborada mediante ingenieria inversa del codigo fuente vigente.

## 2. Objetivo del modulo
Definir y controlar las capacidades funcionales que el sistema debe ofrecer en el ambito de Documentos para soportar procesos internos del negocio.

## 3. Alcance funcional
- Gestion de capacidades de negocio implementadas en el modulo Documentos.
- Ejecucion de flujos CRUD/transaccionales soportados por rutas y servicios actuales.
- Consumo de componentes frontend vinculados y contratos API del backend.
- Aplicacion de controles de seguridad, validacion y trazabilidad detectados en el codigo.

## 4. Actores del sistema
- Comercial
- Gerencia
- Servicios/integraciones externas del modulo
- Tecnico
- Usuario autenticado del proceso interno

## 5. Descripcion general del modulo
El modulo Documentos se implementa principalmente en backend/src/modules/documents y se integra con la arquitectura API del sistema mediante rutas, controladores y servicios. Su comportamiento funcional actual se apoya en validaciones de entrada, control de permisos y trazabilidad operativa.

## 6. Funcionalidades identificadas
- Operacion API detectada: GET /:documentId.
- Operacion API detectada: GET /by-request/:requestId.
- Operacion API detectada: POST /:documentId/export-pdf.
- Operacion API detectada: POST /:documentId/sign.
- Operacion API detectada: POST /:documentId/sign-advanced.
- Operacion API detectada: POST /from-template.
- [Funcionalidad detectada en el sistema] Persistencia/transaccion sobre tablas: document_signatures, documents, requests.

### Endpoints de API detectados
- GET /:documentId
- GET /by-request/:requestId
- POST /:documentId/export-pdf
- POST /:documentId/sign
- POST /:documentId/sign-advanced
- POST /from-template

### Componentes del sistema
- backend\src\modules\documents\document.service.js
- backend\src\modules\documents\documents.controller.js
- backend\src\modules\documents\documents.routes.js

### Componentes frontend relacionados
- spi_front\src\core\api\documentsApi.js

### Tablas/entidades de datos detectadas
- document_signatures
- documents
- requests

## 7. Requerimientos funcionales de alto nivel
- REQ-DOCU-001: El sistema debe permitir consultar y listar informacion operativa del modulo Documentos segun los permisos del actor.
- REQ-DOCU-002: El sistema debe permitir registrar nuevas operaciones/transacciones del modulo Documentos con validaciones de entrada.
- REQ-DOCU-003: El sistema debe permitir gestionar evidencia documental asociada al modulo Documentos, incluyendo carga y consulta.
- REQ-DOCU-004: El sistema debe permitir generar salidas de control (reportes, resumenes o metricas) para seguimiento del modulo Documentos.
- REQ-DOCU-005: El sistema debe interoperar con integraciones externas del modulo Documentos: Generacion documental PDF, Google OAuth/Drive.

## 8. Requerimientos no funcionales
- RNF-DOCU-001: El modulo debe aplicar control de acceso por autenticacion y autorizacion acorde a la sensibilidad del proceso.
- RNF-DOCU-002: El modulo debe mantener integridad de datos en operaciones de escritura, con manejo transaccional cuando aplique.
- RNF-DOCU-003: El modulo debe registrar trazabilidad/auditoria de acciones criticas para soporte de control interno.
- RNF-DOCU-004: El modulo debe gestionar errores de forma estandarizada, devolviendo codigos y mensajes tecnicos consumibles por frontend.
- RNF-DOCU-005: El modulo debe proteger datos sensibles en transito y en almacenamiento, segun politicas de seguridad del sistema.
- RNF-DOCU-006: El modulo debe sostener rendimiento operativo en consultas y operaciones frecuentes del proceso.
- RNF-DOCU-007: El modulo debe soportar disponibilidad operativa para jornadas internas y continuidad de procesos.
- RNF-DOCU-008: El modulo debe ser mantenible, con separacion clara de rutas, controladores y servicios en el codigo actual.

## 9. Reglas de negocio
- RN-DOCU-001: Solo los roles autorizados pueden ejecutar operaciones sensibles del modulo: comercial, gerencia, tecnico.
- RN-DOCU-002: Las operaciones del modulo deben persistir informacion en las tablas asociadas manteniendo consistencia de datos.
- RN-DOCU-003: Las integraciones externas del modulo deben ejecutarse con tolerancia a fallos y trazabilidad de incidencias.
- RN-DOCU-004: [Funcionalidad detectada en el sistema] Se identifican reglas implicitas implementadas en servicios/controladores que deben formalizarse en el FRS.

## 10. Dependencias con otros modulos
- El modulo opera con acoplamiento interno minimo; no se detectaron dependencias directas explicitas hacia otros modulos de negocio.
- Integraciones externas detectadas: Generacion documental PDF, Google OAuth/Drive.

