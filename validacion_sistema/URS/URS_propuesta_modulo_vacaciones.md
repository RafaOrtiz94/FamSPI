# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Vacaciones

## 1. Introduccion
Este documento presenta la propuesta de requerimientos del modulo Vacaciones del Sistema de Procesos Internos SPI, elaborada mediante ingenieria inversa del codigo fuente vigente.

## 2. Objetivo del modulo
Definir y controlar las capacidades funcionales que el sistema debe ofrecer en el ambito de Vacaciones para soportar procesos internos del negocio.

## 3. Alcance funcional
- Gestion de capacidades de negocio implementadas en el modulo Vacaciones.
- Ejecucion de flujos CRUD/transaccionales soportados por rutas y servicios actuales.
- Consumo de componentes frontend vinculados y contratos API del backend.
- Aplicacion de controles de seguridad, validacion y trazabilidad detectados en el codigo.

## 4. Actores del sistema
- Servicios/integraciones externas del modulo
- Usuario autenticado del proceso interno

## 5. Descripcion general del modulo
El modulo Vacaciones se implementa principalmente en backend/src/modules/vacaciones y se integra con la arquitectura API del sistema mediante rutas, controladores y servicios. Su comportamiento funcional actual se apoya en validaciones de entrada, control de permisos y trazabilidad operativa.

## 6. Funcionalidades identificadas
- Operacion API detectada: GET /.
- Operacion API detectada: GET /legal-verification/:token.
- Operacion API detectada: GET /summary/data.
- Operacion API detectada: PATCH /:id/status.
- Operacion API detectada: POST /.
- Operacion API detectada: POST /:id/cancel.
- Operacion API detectada: POST /:id/cancel/review.
- [Funcionalidad detectada en el sistema] Persistencia/transaccion sobre tablas: collaborator_profiles, departments, ranked, start_date, users, vacaciones_saldos_historicos, vacaciones_solicitudes, vacaciones_solicitudes_firmas.

### Endpoints de API detectados
- GET /
- GET /legal-verification/:token
- GET /summary/data
- PATCH /:id/status
- POST /
- POST /:id/cancel
- POST /:id/cancel/review

### Componentes del sistema
- backend\src\modules\vacaciones\vacaciones.controller.js
- backend\src\modules\vacaciones\vacaciones.routes.js
- backend\src\modules\vacaciones\vacaciones.service.js

### Componentes frontend relacionados
- spi_front\src\core\api\vacationsApi.js

### Tablas/entidades de datos detectadas
- collaborator_profiles
- departments
- ranked
- start_date
- users
- vacaciones_saldos_historicos
- vacaciones_solicitudes
- vacaciones_solicitudes_firmas

## 7. Requerimientos funcionales de alto nivel
- REQ-VACA-001: El sistema debe permitir consultar y listar informacion operativa del modulo Vacaciones segun los permisos del actor.
- REQ-VACA-002: El sistema debe permitir registrar nuevas operaciones/transacciones del modulo Vacaciones con validaciones de entrada.
- REQ-VACA-003: El sistema debe permitir actualizar datos y estados del modulo Vacaciones preservando trazabilidad.
- REQ-VACA-004: El sistema debe controlar cambios de estado/aprobacion del proceso en Vacaciones segun reglas y roles definidos.
- REQ-VACA-005: El sistema debe permitir generar salidas de control (reportes, resumenes o metricas) para seguimiento del modulo Vacaciones.
- REQ-VACA-006: El sistema debe interoperar con integraciones externas del modulo Vacaciones: Calendario, Eventos en tiempo real, Generacion documental PDF, Google OAuth/Drive.

## 8. Requerimientos no funcionales
- RNF-VACA-001: El modulo debe aplicar control de acceso por autenticacion y autorizacion acorde a la sensibilidad del proceso.
- RNF-VACA-002: El modulo debe mantener integridad de datos en operaciones de escritura, con manejo transaccional cuando aplique.
- RNF-VACA-003: El modulo debe registrar trazabilidad/auditoria de acciones criticas para soporte de control interno.
- RNF-VACA-004: El modulo debe gestionar errores de forma estandarizada, devolviendo codigos y mensajes tecnicos consumibles por frontend.
- RNF-VACA-005: El modulo debe proteger datos sensibles en transito y en almacenamiento, segun politicas de seguridad del sistema.
- RNF-VACA-006: El modulo debe sostener rendimiento operativo en consultas y operaciones frecuentes del proceso.
- RNF-VACA-007: El modulo debe soportar disponibilidad operativa para jornadas internas y continuidad de procesos.
- RNF-VACA-008: El modulo debe ser mantenible, con separacion clara de rutas, controladores y servicios en el codigo actual.

## 9. Reglas de negocio
- RN-VACA-001: Las operaciones del modulo deben ejecutarse solo por actores autenticados con permisos efectivos del contexto.
- RN-VACA-002: Los cambios de estado deben respetar la secuencia de negocio definida por la logica actual del modulo.
- RN-VACA-003: Las operaciones del modulo deben persistir informacion en las tablas asociadas manteniendo consistencia de datos.
- RN-VACA-004: Las integraciones externas del modulo deben ejecutarse con tolerancia a fallos y trazabilidad de incidencias.
- RN-VACA-005: [Funcionalidad detectada en el sistema] Se identifican reglas implicitas implementadas en servicios/controladores que deben formalizarse en el FRS.

## 10. Dependencias con otros modulos
- Notificaciones
- Permisos
- Integraciones externas detectadas: Calendario, Eventos en tiempo real, Generacion documental PDF, Google OAuth/Drive.

