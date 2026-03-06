# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Finanzas

## 1. Introduccion
Este documento presenta la propuesta de requerimientos del modulo Finanzas del Sistema de Procesos Internos SPI, elaborada mediante ingenieria inversa del codigo fuente vigente.

## 2. Objetivo del modulo
Definir y controlar las capacidades funcionales que el sistema debe ofrecer en el ambito de Finanzas para soportar procesos internos del negocio.

## 3. Alcance funcional
- Gestion de capacidades de negocio implementadas en el modulo Finanzas.
- Ejecucion de flujos CRUD/transaccionales soportados por rutas y servicios actuales.
- Consumo de componentes frontend vinculados y contratos API del backend.
- Aplicacion de controles de seguridad, validacion y trazabilidad detectados en el codigo.

## 4. Actores del sistema
- Finanzas
- Gerencia
- Servicios/integraciones externas del modulo
- Usuario autenticado del proceso interno

## 5. Descripcion general del modulo
El modulo Finanzas se implementa principalmente en backend/src/modules/finanzas y se integra con la arquitectura API del sistema mediante rutas, controladores y servicios. Su comportamiento funcional actual se apoya en validaciones de entrada, control de permisos y trazabilidad operativa.

## 6. Funcionalidades identificadas
- Operacion API detectada: GET /api/v1/inventory.
- Operacion API detectada: GET /api/v1/inventory/report.
- Operacion API detectada: POST /api/v1/inventory/move.
- Operacion API detectada: POST /api/v1/inventory/sync.
- [Funcionalidad detectada en el sistema] Persistencia/transaccion sobre tablas: inventory, inventory_movements.

### Endpoints de API detectados
- GET /api/v1/inventory
- GET /api/v1/inventory/report
- POST /api/v1/inventory/move
- POST /api/v1/inventory/sync

### Componentes del sistema
- backend\src\modules\finanzas\finanzas.controller.js
- backend\src\modules\finanzas\finanzas.routes.js
- backend\src\modules\finanzas\finanzas.service.js

### Componentes frontend relacionados
- spi_front\src\modules\finanzas\Dashboard.jsx
- spi_front\src\modules\finanzas\pages\ViaticosWorkspace.jsx

### Tablas/entidades de datos detectadas
- inventory
- inventory_movements

## 7. Requerimientos funcionales de alto nivel
- REQ-FINA-001: El sistema debe permitir consultar y listar informacion operativa del modulo Finanzas segun los permisos del actor.
- REQ-FINA-002: El sistema debe permitir registrar nuevas operaciones/transacciones del modulo Finanzas con validaciones de entrada.
- REQ-FINA-003: El sistema debe permitir generar salidas de control (reportes, resumenes o metricas) para seguimiento del modulo Finanzas.
- REQ-FINA-004: El sistema debe interoperar con integraciones externas del modulo Finanzas: APIs HTTP externas.
- REQ-FINA-005: [Funcionalidad detectada en el sistema] El modulo Finanzas incluye logica interna adicional en servicios/controladores no expuesta completamente por contratos funcionales formales.
- REQ-FINA-006: El sistema debe garantizar ejecucion consistente de la logica de negocio del modulo Finanzas en escenarios nominales y de error.

## 8. Requerimientos no funcionales
- RNF-FINA-001: El modulo debe aplicar control de acceso por autenticacion y autorizacion acorde a la sensibilidad del proceso.
- RNF-FINA-002: El modulo debe mantener integridad de datos en operaciones de escritura, con manejo transaccional cuando aplique.
- RNF-FINA-003: El modulo debe registrar trazabilidad/auditoria de acciones criticas para soporte de control interno.
- RNF-FINA-004: El modulo debe gestionar errores de forma estandarizada, devolviendo codigos y mensajes tecnicos consumibles por frontend.
- RNF-FINA-005: El modulo debe proteger datos sensibles en transito y en almacenamiento, segun politicas de seguridad del sistema.
- RNF-FINA-006: El modulo debe sostener rendimiento operativo en consultas y operaciones frecuentes del proceso.
- RNF-FINA-007: El modulo debe soportar disponibilidad operativa para jornadas internas y continuidad de procesos.
- RNF-FINA-008: El modulo debe ser mantenible, con separacion clara de rutas, controladores y servicios en el codigo actual.

## 9. Reglas de negocio
- RN-FINA-001: Solo los roles autorizados pueden ejecutar operaciones sensibles del modulo: finanzas, gerencia.
- RN-FINA-002: Las operaciones del modulo deben persistir informacion en las tablas asociadas manteniendo consistencia de datos.
- RN-FINA-003: Las integraciones externas del modulo deben ejecutarse con tolerancia a fallos y trazabilidad de incidencias.
- RN-FINA-004: [Funcionalidad detectada en el sistema] Se identifican reglas implicitas implementadas en servicios/controladores que deben formalizarse en el FRS.

## 10. Dependencias con otros modulos
- El modulo opera con acoplamiento interno minimo; no se detectaron dependencias directas explicitas hacia otros modulos de negocio.
- Integraciones externas detectadas: APIs HTTP externas.

