# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Gestion de Archivos

## 1. Introduccion
Este documento presenta la propuesta de requerimientos del modulo Gestion de Archivos del Sistema de Procesos Internos SPI, elaborada mediante ingenieria inversa del codigo fuente vigente.

## 2. Objetivo del modulo
Definir y controlar las capacidades funcionales que el sistema debe ofrecer en el ambito de Gestion de Archivos para soportar procesos internos del negocio.

## 3. Alcance funcional
- Gestion de capacidades de negocio implementadas en el modulo Gestion de Archivos.
- Ejecucion de flujos CRUD/transaccionales soportados por rutas y servicios actuales.
- Consumo de componentes frontend vinculados y contratos API del backend.
- Aplicacion de controles de seguridad, validacion y trazabilidad detectados en el codigo.

## 4. Actores del sistema
- Admin
- Comercial
- Gerencia
- Servicios/integraciones externas del modulo
- Tecnico
- Usuario autenticado del proceso interno

## 5. Descripcion general del modulo
El modulo Gestion de Archivos se implementa principalmente en backend/src/modules/files y se integra con la arquitectura API del sistema mediante rutas, controladores y servicios. Su comportamiento funcional actual se apoya en validaciones de entrada, control de permisos y trazabilidad operativa.

## 6. Funcionalidades identificadas
- Operacion API detectada: DELETE /:fileId.
- Operacion API detectada: GET /:fileId/download.
- Operacion API detectada: GET /:fileId/metadata.
- Operacion API detectada: GET /by-request/:requestId.
- Operacion API detectada: POST /upload/:requestId.
- [Funcionalidad detectada en el sistema] Persistencia/transaccion sobre tablas: request_attachments.

### Endpoints de API detectados
- DELETE /:fileId
- GET /:fileId/download
- GET /:fileId/metadata
- GET /by-request/:requestId
- POST /upload/:requestId

### Componentes del sistema
- backend\src\modules\files\file.service.js
- backend\src\modules\files\files.controller.js
- backend\src\modules\files\files.routes.js

### Componentes frontend relacionados
- spi_front\src\core\api\filesApi.js

### Tablas/entidades de datos detectadas
- request_attachments

## 7. Requerimientos funcionales de alto nivel
- REQ-FILE-001: El sistema debe permitir consultar y listar informacion operativa del modulo Gestion de Archivos segun los permisos del actor.
- REQ-FILE-002: El sistema debe permitir registrar nuevas operaciones/transacciones del modulo Gestion de Archivos con validaciones de entrada.
- REQ-FILE-003: El sistema debe permitir ejecutar eliminaciones controladas del modulo Gestion de Archivos cuando el flujo de negocio lo permita.
- REQ-FILE-004: El sistema debe permitir gestionar evidencia documental asociada al modulo Gestion de Archivos, incluyendo carga y consulta.
- REQ-FILE-005: El sistema debe interoperar con integraciones externas del modulo Gestion de Archivos: Eventos en tiempo real, Google OAuth/Drive.

## 8. Requerimientos no funcionales
- RNF-FILE-001: El modulo debe aplicar control de acceso por autenticacion y autorizacion acorde a la sensibilidad del proceso.
- RNF-FILE-002: El modulo debe mantener integridad de datos en operaciones de escritura, con manejo transaccional cuando aplique.
- RNF-FILE-003: El modulo debe registrar trazabilidad/auditoria de acciones criticas para soporte de control interno.
- RNF-FILE-004: El modulo debe gestionar errores de forma estandarizada, devolviendo codigos y mensajes tecnicos consumibles por frontend.
- RNF-FILE-005: El modulo debe proteger datos sensibles en transito y en almacenamiento, segun politicas de seguridad del sistema.
- RNF-FILE-006: El modulo debe sostener rendimiento operativo en consultas y operaciones frecuentes del proceso.
- RNF-FILE-007: El modulo debe soportar disponibilidad operativa para jornadas internas y continuidad de procesos.
- RNF-FILE-008: El modulo debe ser mantenible, con separacion clara de rutas, controladores y servicios en el codigo actual.

## 9. Reglas de negocio
- RN-FILE-001: Solo los roles autorizados pueden ejecutar operaciones sensibles del modulo: admin, comercial, gerencia, tecnico.
- RN-FILE-002: Las operaciones del modulo deben persistir informacion en las tablas asociadas manteniendo consistencia de datos.
- RN-FILE-003: Las integraciones externas del modulo deben ejecutarse con tolerancia a fallos y trazabilidad de incidencias.
- RN-FILE-004: [Funcionalidad detectada en el sistema] Se identifican reglas implicitas implementadas en servicios/controladores que deben formalizarse en el FRS.

## 10. Dependencias con otros modulos
- El modulo opera con acoplamiento interno minimo; no se detectaron dependencias directas explicitas hacia otros modulos de negocio.
- Integraciones externas detectadas: Eventos en tiempo real, Google OAuth/Drive.

