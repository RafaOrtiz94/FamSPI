# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Dashboard

## 1. Introduccion
Este documento presenta la propuesta de requerimientos del modulo Dashboard del Sistema de Procesos Internos SPI, elaborada mediante ingenieria inversa del codigo fuente vigente.

## 2. Objetivo del modulo
Definir y controlar las capacidades funcionales que el sistema debe ofrecer en el ambito de Dashboard para soportar procesos internos del negocio.

## 3. Alcance funcional
- Gestion de capacidades de negocio implementadas en el modulo Dashboard.
- Ejecucion de flujos CRUD/transaccionales soportados por rutas y servicios actuales.
- Consumo de componentes frontend vinculados y contratos API del backend.
- Aplicacion de controles de seguridad, validacion y trazabilidad detectados en el codigo.

## 4. Actores del sistema
- Servicios/integraciones externas del modulo
- Usuario autenticado del proceso interno

## 5. Descripcion general del modulo
El modulo Dashboard se implementa principalmente en backend/src/modules/dashboard y se integra con la arquitectura API del sistema mediante rutas, controladores y servicios. Su comportamiento funcional actual se apoya en validaciones de entrada, control de permisos y trazabilidad operativa.

## 6. Funcionalidades identificadas
- Operacion API detectada: GET /comercial/summary.
- [Funcionalidad detectada en el sistema] Persistencia/transaccion sobre tablas: bc_master, clients, requests.

### Endpoints de API detectados
- GET /comercial/summary

### Componentes del sistema
- backend\src\modules\dashboard\dashboard.controller.js
- backend\src\modules\dashboard\dashboard.routes.js
- backend\src\modules\dashboard\dashboard.service.js

### Componentes frontend relacionados
- spi_front\src\core\api\dashboardApi.js

### Tablas/entidades de datos detectadas
- bc_master
- clients
- requests

## 7. Requerimientos funcionales de alto nivel
- REQ-DASH-001: El sistema debe permitir consultar y listar informacion operativa del modulo Dashboard segun los permisos del actor.
- REQ-DASH-002: El sistema debe permitir generar salidas de control (reportes, resumenes o metricas) para seguimiento del modulo Dashboard.
- REQ-DASH-003: El sistema debe interoperar con integraciones externas del modulo Dashboard: Eventos en tiempo real.
- REQ-DASH-004: [Funcionalidad detectada en el sistema] El modulo Dashboard incluye logica interna adicional en servicios/controladores no expuesta completamente por contratos funcionales formales.
- REQ-DASH-005: El sistema debe garantizar ejecucion consistente de la logica de negocio del modulo Dashboard en escenarios nominales y de error.

## 8. Requerimientos no funcionales
- RNF-DASH-001: El modulo debe aplicar control de acceso por autenticacion y autorizacion acorde a la sensibilidad del proceso.
- RNF-DASH-002: El modulo debe mantener integridad de datos en operaciones de escritura, con manejo transaccional cuando aplique.
- RNF-DASH-003: El modulo debe registrar trazabilidad/auditoria de acciones criticas para soporte de control interno.
- RNF-DASH-004: El modulo debe gestionar errores de forma estandarizada, devolviendo codigos y mensajes tecnicos consumibles por frontend.
- RNF-DASH-005: El modulo debe proteger datos sensibles en transito y en almacenamiento, segun politicas de seguridad del sistema.
- RNF-DASH-006: El modulo debe sostener rendimiento operativo en consultas y operaciones frecuentes del proceso.
- RNF-DASH-007: El modulo debe soportar disponibilidad operativa para jornadas internas y continuidad de procesos.
- RNF-DASH-008: El modulo debe ser mantenible, con separacion clara de rutas, controladores y servicios en el codigo actual.

## 9. Reglas de negocio
- RN-DASH-001: Las operaciones del modulo deben ejecutarse solo por actores autenticados con permisos efectivos del contexto.
- RN-DASH-002: Las operaciones del modulo deben persistir informacion en las tablas asociadas manteniendo consistencia de datos.
- RN-DASH-003: Las integraciones externas del modulo deben ejecutarse con tolerancia a fallos y trazabilidad de incidencias.
- RN-DASH-004: [Funcionalidad detectada en el sistema] Se identifican reglas implicitas implementadas en servicios/controladores que deben formalizarse en el FRS.

## 10. Dependencias con otros modulos
- El modulo opera con acoplamiento interno minimo; no se detectaron dependencias directas explicitas hacia otros modulos de negocio.
- Integraciones externas detectadas: Eventos en tiempo real.

