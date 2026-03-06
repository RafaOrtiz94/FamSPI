# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Gestion Administrativa

## 1. Introduccion
Este documento presenta la propuesta de requerimientos del modulo Gestion Administrativa del Sistema de Procesos Internos SPI, elaborada mediante ingenieria inversa del codigo fuente vigente.

## 2. Objetivo del modulo
Definir y controlar las capacidades funcionales que el sistema debe ofrecer en el ambito de Gestion Administrativa para soportar procesos internos del negocio.

## 3. Alcance funcional
- Gestion de capacidades de negocio implementadas en el modulo Gestion Administrativa.
- Ejecucion de flujos CRUD/transaccionales soportados por rutas y servicios actuales.
- Consumo de componentes frontend vinculados y contratos API del backend.
- Aplicacion de controles de seguridad, validacion y trazabilidad detectados en el codigo.

## 4. Actores del sistema
- Admin
- Gerente General
- Usuario autenticado del proceso interno

## 5. Descripcion general del modulo
El modulo Gestion Administrativa se implementa principalmente en backend/src/modules/management y se integra con la arquitectura API del sistema mediante rutas, controladores y servicios. Su comportamiento funcional actual se apoya en validaciones de entrada, control de permisos y trazabilidad operativa.

## 6. Funcionalidades identificadas
- Operacion API detectada: GET /documents/:id.
- Operacion API detectada: GET /requests.
- Operacion API detectada: GET /stats.
- Operacion API detectada: GET /trace/:id.
- [Funcionalidad detectada en el sistema] Persistencia/transaccion sobre tablas: attachments, audit_logs, request_types, request_versions, requests, users.

### Endpoints de API detectados
- GET /documents/:id
- GET /requests
- GET /stats
- GET /trace/:id

### Componentes del sistema
- backend\src\modules\management\management.controller.js
- backend\src\modules\management\management.routes.js
- backend\src\modules\management\management.service.js

### Componentes frontend relacionados
- spi_front\src\modules\comercial\components\ClientManagementActionCard.jsx
- spi_front\src\modules\comercial\components\ClientRequestManagement.jsx
- spi_front\src\modules\servicio\components\dashboard\ConsumiblesManagement.jsx
- spi_front\src\modules\servicio\components\dashboard\ControlesManagement.jsx
- spi_front\src\modules\servicio\components\dashboard\DeterminacionesManagement.jsx
- spi_front\src\modules\servicio\components\dashboard\EquiposManagement.jsx
- spi_front\src\modules\servicio\components\dashboard\PiezasMantenimientoManagement.jsx
- spi_front\src\modules\servicio\components\dashboard\ReactivosManagement.jsx

### Tablas/entidades de datos detectadas
- attachments
- audit_logs
- request_types
- request_versions
- requests
- users

## 7. Requerimientos funcionales de alto nivel
- REQ-MANA-001: El sistema debe permitir consultar y listar informacion operativa del modulo Gestion Administrativa segun los permisos del actor.
- REQ-MANA-002: El sistema debe permitir gestionar evidencia documental asociada al modulo Gestion Administrativa, incluyendo carga y consulta.
- REQ-MANA-003: El sistema debe permitir generar salidas de control (reportes, resumenes o metricas) para seguimiento del modulo Gestion Administrativa.
- REQ-MANA-004: [Funcionalidad detectada en el sistema] El modulo Gestion Administrativa incluye logica interna adicional en servicios/controladores no expuesta completamente por contratos funcionales formales.
- REQ-MANA-005: El sistema debe garantizar ejecucion consistente de la logica de negocio del modulo Gestion Administrativa en escenarios nominales y de error.

## 8. Requerimientos no funcionales
- RNF-MANA-001: El modulo debe aplicar control de acceso por autenticacion y autorizacion acorde a la sensibilidad del proceso.
- RNF-MANA-002: El modulo debe mantener integridad de datos en operaciones de escritura, con manejo transaccional cuando aplique.
- RNF-MANA-003: El modulo debe registrar trazabilidad/auditoria de acciones criticas para soporte de control interno.
- RNF-MANA-004: El modulo debe gestionar errores de forma estandarizada, devolviendo codigos y mensajes tecnicos consumibles por frontend.
- RNF-MANA-005: El modulo debe proteger datos sensibles en transito y en almacenamiento, segun politicas de seguridad del sistema.
- RNF-MANA-006: El modulo debe sostener rendimiento operativo en consultas y operaciones frecuentes del proceso.
- RNF-MANA-007: El modulo debe soportar disponibilidad operativa para jornadas internas y continuidad de procesos.
- RNF-MANA-008: El modulo debe ser mantenible, con separacion clara de rutas, controladores y servicios en el codigo actual.

## 9. Reglas de negocio
- RN-MANA-001: Solo los roles autorizados pueden ejecutar operaciones sensibles del modulo: admin, gerente_general.
- RN-MANA-002: Las operaciones del modulo deben persistir informacion en las tablas asociadas manteniendo consistencia de datos.
- RN-MANA-003: [Funcionalidad detectada en el sistema] Se identifican reglas implicitas implementadas en servicios/controladores que deben formalizarse en el FRS.

## 10. Dependencias con otros modulos
- El modulo opera con acoplamiento interno minimo; no se detectaron dependencias directas explicitas hacia otros modulos de negocio.

