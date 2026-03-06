# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Auditoria

## 1. Introduccion
Este documento presenta la propuesta de requerimientos del modulo Auditoria del Sistema de Procesos Internos SPI, elaborada mediante ingenieria inversa del codigo fuente vigente.

## 2. Objetivo del modulo
Definir y controlar las capacidades funcionales que el sistema debe ofrecer en el ambito de Auditoria para soportar procesos internos del negocio.

## 3. Alcance funcional
- Gestion de capacidades de negocio implementadas en el modulo Auditoria.
- Ejecucion de flujos CRUD/transaccionales soportados por rutas y servicios actuales.
- Consumo de componentes frontend vinculados y contratos API del backend.
- Aplicacion de controles de seguridad, validacion y trazabilidad detectados en el codigo.

## 4. Actores del sistema
- Gerencia
- Ti
- Usuario autenticado del proceso interno

## 5. Descripcion general del modulo
El modulo Auditoria se implementa principalmente en backend/src/modules/auditoria y se integra con la arquitectura API del sistema mediante rutas, controladores y servicios. Su comportamiento funcional actual se apoya en validaciones de entrada, control de permisos y trazabilidad operativa.

## 6. Funcionalidades identificadas
- Operacion API detectada: GET /.
- Operacion API detectada: GET /:id.
- Operacion API detectada: GET /export/csv.
- [Funcionalidad detectada en el sistema] Persistencia/transaccion sobre tablas: auditoria.logs.

### Endpoints de API detectados
- GET /
- GET /:id
- GET /export/csv

### Componentes del sistema
- backend\src\modules\auditoria\audit.controller.js
- backend\src\modules\auditoria\audit.routes.js
- backend\src\modules\auditoria\auditoria.service.js

### Componentes frontend relacionados
- spi_front\src\core\api\auditoriaApi.js

### Tablas/entidades de datos detectadas
- auditoria.logs

## 7. Requerimientos funcionales de alto nivel
- REQ-AUDI-001: El sistema debe permitir consultar y listar informacion operativa del modulo Auditoria segun los permisos del actor.
- REQ-AUDI-002: El sistema debe permitir generar salidas de control (reportes, resumenes o metricas) para seguimiento del modulo Auditoria.
- REQ-AUDI-003: [Funcionalidad detectada en el sistema] El modulo Auditoria incluye logica interna adicional en servicios/controladores no expuesta completamente por contratos funcionales formales.
- REQ-AUDI-004: El sistema debe garantizar ejecucion consistente de la logica de negocio del modulo Auditoria en escenarios nominales y de error.

## 8. Requerimientos no funcionales
- RNF-AUDI-001: El modulo debe aplicar control de acceso por autenticacion y autorizacion acorde a la sensibilidad del proceso.
- RNF-AUDI-002: El modulo debe mantener integridad de datos en operaciones de escritura, con manejo transaccional cuando aplique.
- RNF-AUDI-003: El modulo debe registrar trazabilidad/auditoria de acciones criticas para soporte de control interno.
- RNF-AUDI-004: El modulo debe gestionar errores de forma estandarizada, devolviendo codigos y mensajes tecnicos consumibles por frontend.
- RNF-AUDI-005: El modulo debe proteger datos sensibles en transito y en almacenamiento, segun politicas de seguridad del sistema.
- RNF-AUDI-006: El modulo debe sostener rendimiento operativo en consultas y operaciones frecuentes del proceso.
- RNF-AUDI-007: El modulo debe soportar disponibilidad operativa para jornadas internas y continuidad de procesos.
- RNF-AUDI-008: El modulo debe ser mantenible, con separacion clara de rutas, controladores y servicios en el codigo actual.

## 9. Reglas de negocio
- RN-AUDI-001: Solo los roles autorizados pueden ejecutar operaciones sensibles del modulo: gerencia, ti.
- RN-AUDI-002: Las operaciones del modulo deben persistir informacion en las tablas asociadas manteniendo consistencia de datos.
- RN-AUDI-003: [Funcionalidad detectada en el sistema] Se identifican reglas implicitas implementadas en servicios/controladores que deben formalizarse en el FRS.

## 10. Dependencias con otros modulos
- El modulo opera con acoplamiento interno minimo; no se detectaron dependencias directas explicitas hacia otros modulos de negocio.

