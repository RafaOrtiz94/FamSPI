# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Permisos

## 1. Introduccion
Este documento presenta la propuesta de requerimientos del modulo Permisos del Sistema de Procesos Internos SPI, elaborada mediante ingenieria inversa del codigo fuente vigente.

## 2. Objetivo del modulo
Definir y controlar las capacidades funcionales que el sistema debe ofrecer en el ambito de Permisos para soportar procesos internos del negocio.

## 3. Alcance funcional
- Gestion de capacidades de negocio implementadas en el modulo Permisos.
- Ejecucion de flujos CRUD/transaccionales soportados por rutas y servicios actuales.
- Consumo de componentes frontend vinculados y contratos API del backend.
- Aplicacion de controles de seguridad, validacion y trazabilidad detectados en el codigo.

## 4. Actores del sistema
- Servicios/integraciones externas del modulo
- Usuario autenticado del proceso interno

## 5. Descripcion general del modulo
El modulo Permisos se implementa principalmente en backend/src/modules/permisos y se integra con la arquitectura API del sistema mediante rutas, controladores y servicios. Su comportamiento funcional actual se apoya en validaciones de entrada, control de permisos y trazabilidad operativa.

## 6. Funcionalidades identificadas
- Operacion API detectada: GET /estudios/matricula/activa.
- Operacion API detectada: GET /estudios/matriculas.
- Operacion API detectada: GET /estudios/matriculas/pendientes.
- Operacion API detectada: GET /legal-coverage.
- Operacion API detectada: GET /legal-verification/:token.
- Operacion API detectada: GET /mis-solicitudes.
- Operacion API detectada: GET /pendientes.
- Operacion API detectada: GET /resumen-colaboradores.
- Operacion API detectada: POST /.
- Operacion API detectada: POST /:id/aprobar-final.
- Operacion API detectada: POST /:id/aprobar-parcial.
- Operacion API detectada: POST /:id/cancelar.
- Operacion API detectada: POST /:id/cancelar/revisar.
- Operacion API detectada: POST /:id/justificantes.
- Operacion API detectada: POST /:id/rechazar.
- Operacion API detectada: POST /:id/recovery-plan.
- Operacion API detectada: POST /estudios/matricula.
- Operacion API detectada: POST /estudios/matriculas/:id/revisar.
- [Funcionalidad detectada en el sistema] Persistencia/transaccion sobre tablas: collaborator_profiles, fecha_inicio, permisos_estudios_matriculas, permisos_vacaciones, permisos_vacaciones_firmas, ranked, users, vacaciones_saldos_historicos.

### Endpoints de API detectados
- GET /estudios/matricula/activa
- GET /estudios/matriculas
- GET /estudios/matriculas/pendientes
- GET /legal-coverage
- GET /legal-verification/:token
- GET /mis-solicitudes
- GET /pendientes
- GET /resumen-colaboradores
- POST /
- POST /:id/aprobar-final
- POST /:id/aprobar-parcial
- POST /:id/cancelar
- POST /:id/cancelar/revisar
- POST /:id/justificantes
- POST /:id/rechazar
- POST /:id/recovery-plan
- POST /estudios/matricula
- POST /estudios/matriculas/:id/revisar

### Componentes del sistema
- backend\src\modules\permisos\permisos.controller.js
- backend\src\modules\permisos\permisos.routes.js
- backend\src\modules\permisos\permisos.service.js

### Componentes frontend relacionados
- spi_front\src\core\api\permisosApi.js

### Tablas/entidades de datos detectadas
- collaborator_profiles
- fecha_inicio
- permisos_estudios_matriculas
- permisos_vacaciones
- permisos_vacaciones_firmas
- ranked
- users
- vacaciones_saldos_historicos

## 7. Requerimientos funcionales de alto nivel
- REQ-PERM-001: El sistema debe permitir consultar y listar informacion operativa del modulo Permisos segun los permisos del actor.
- REQ-PERM-002: El sistema debe permitir registrar nuevas operaciones/transacciones del modulo Permisos con validaciones de entrada.
- REQ-PERM-003: El sistema debe interoperar con integraciones externas del modulo Permisos: Calendario, Eventos en tiempo real, Generacion documental PDF, Google OAuth/Drive.
- REQ-PERM-004: [Funcionalidad detectada en el sistema] El modulo Permisos incluye logica interna adicional en servicios/controladores no expuesta completamente por contratos funcionales formales.
- REQ-PERM-005: El sistema debe garantizar ejecucion consistente de la logica de negocio del modulo Permisos en escenarios nominales y de error.

## 8. Requerimientos no funcionales
- RNF-PERM-001: El modulo debe aplicar control de acceso por autenticacion y autorizacion acorde a la sensibilidad del proceso.
- RNF-PERM-002: El modulo debe mantener integridad de datos en operaciones de escritura, con manejo transaccional cuando aplique.
- RNF-PERM-003: El modulo debe registrar trazabilidad/auditoria de acciones criticas para soporte de control interno.
- RNF-PERM-004: El modulo debe gestionar errores de forma estandarizada, devolviendo codigos y mensajes tecnicos consumibles por frontend.
- RNF-PERM-005: El modulo debe proteger datos sensibles en transito y en almacenamiento, segun politicas de seguridad del sistema.
- RNF-PERM-006: El modulo debe sostener rendimiento operativo en consultas y operaciones frecuentes del proceso.
- RNF-PERM-007: El modulo debe soportar disponibilidad operativa para jornadas internas y continuidad de procesos.
- RNF-PERM-008: El modulo debe ser mantenible, con separacion clara de rutas, controladores y servicios en el codigo actual.

## 9. Reglas de negocio
- RN-PERM-001: Las operaciones del modulo deben ejecutarse solo por actores autenticados con permisos efectivos del contexto.
- RN-PERM-002: Las operaciones del modulo deben persistir informacion en las tablas asociadas manteniendo consistencia de datos.
- RN-PERM-003: Las integraciones externas del modulo deben ejecutarse con tolerancia a fallos y trazabilidad de incidencias.
- RN-PERM-004: [Funcionalidad detectada en el sistema] Se identifican reglas implicitas implementadas en servicios/controladores que deben formalizarse en el FRS.
- RN-PERM-005: En la revision de una cancelacion pendiente, el motivo es obligatorio solo cuando el aprobador rechaza la cancelacion; si la aprueba, la observacion adicional es opcional.

## 10. Dependencias con otros modulos
- Notificaciones
- Integraciones externas detectadas: Calendario, Eventos en tiempo real, Generacion documental PDF, Google OAuth/Drive.
