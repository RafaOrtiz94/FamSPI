# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Mantenimientos

## 1. Introduccion
Este documento presenta la propuesta de requerimientos del modulo Mantenimientos del Sistema de Procesos Internos SPI, elaborada mediante ingenieria inversa del codigo fuente vigente.

## 2. Objetivo del modulo
Definir y controlar las capacidades funcionales que el sistema debe ofrecer en el ambito de Mantenimientos para soportar procesos internos del negocio.

## 3. Alcance funcional
- Gestion de capacidades de negocio implementadas en el modulo Mantenimientos.
- Ejecucion de flujos CRUD/transaccionales soportados por rutas y servicios actuales.
- Consumo de componentes frontend vinculados y contratos API del backend.
- Aplicacion de controles de seguridad, validacion y trazabilidad detectados en el codigo.

## 4. Actores del sistema
- Gerencia
- Servicios/integraciones externas del modulo
- Tecnico
- Usuario autenticado del proceso interno

## 5. Descripcion general del modulo
El modulo Mantenimientos se implementa principalmente en backend/src/modules/mantenimientos y se integra con la arquitectura API del sistema mediante rutas, controladores y servicios. Su comportamiento funcional actual se apoya en validaciones de entrada, control de permisos y trazabilidad operativa.

## 6. Funcionalidades identificadas
- Operacion API detectada: GET /.
- Operacion API detectada: GET /:id.
- Operacion API detectada: POST /.
- Operacion API detectada: POST /:id/approve.
- Operacion API detectada: POST /:id/export.
- Operacion API detectada: POST /:id/sign.
- Operacion API detectada: POST /:id/sign-advanced.
- [Funcionalidad detectada en el sistema] Persistencia/transaccion sobre tablas: documents, public.users, servicio.cronograma_mantenimientos, users.

### Endpoints de API detectados
- GET /
- GET /:id
- POST /
- POST /:id/approve
- POST /:id/export
- POST /:id/sign
- POST /:id/sign-advanced

### Componentes del sistema
- backend\src\modules\mantenimientos\mantenimientos.controller.js
- backend\src\modules\mantenimientos\mantenimientos.routes.js
- backend\src\modules\mantenimientos\mantenimientos.service.js

### Componentes frontend relacionados
- spi_front\src\core\api\mantenimientosApi.js

### Tablas/entidades de datos detectadas
- documents
- public.users
- servicio.cronograma_mantenimientos
- users

## 7. Requerimientos funcionales de alto nivel
- REQ-MANT-001: El sistema debe permitir consultar y listar informacion operativa del modulo Mantenimientos segun los permisos del actor.
- REQ-MANT-002: El sistema debe permitir registrar nuevas operaciones/transacciones del modulo Mantenimientos con validaciones de entrada.
- REQ-MANT-003: El sistema debe controlar cambios de estado/aprobacion del proceso en Mantenimientos segun reglas y roles definidos.
- REQ-MANT-004: El sistema debe permitir generar salidas de control (reportes, resumenes o metricas) para seguimiento del modulo Mantenimientos.
- REQ-MANT-005: El sistema debe interoperar con integraciones externas del modulo Mantenimientos: Correo corporativo, Eventos en tiempo real, Generacion documental PDF, Google OAuth/Drive.

## 8. Requerimientos no funcionales
- RNF-MANT-001: El modulo debe aplicar control de acceso por autenticacion y autorizacion acorde a la sensibilidad del proceso.
- RNF-MANT-002: El modulo debe mantener integridad de datos en operaciones de escritura, con manejo transaccional cuando aplique.
- RNF-MANT-003: El modulo debe registrar trazabilidad/auditoria de acciones criticas para soporte de control interno.
- RNF-MANT-004: El modulo debe gestionar errores de forma estandarizada, devolviendo codigos y mensajes tecnicos consumibles por frontend.
- RNF-MANT-005: El modulo debe proteger datos sensibles en transito y en almacenamiento, segun politicas de seguridad del sistema.
- RNF-MANT-006: El modulo debe sostener rendimiento operativo en consultas y operaciones frecuentes del proceso.
- RNF-MANT-007: El modulo debe soportar disponibilidad operativa para jornadas internas y continuidad de procesos.
- RNF-MANT-008: El modulo debe ser mantenible, con separacion clara de rutas, controladores y servicios en el codigo actual.

## 9. Reglas de negocio
- RN-MANT-001: Solo los roles autorizados pueden ejecutar operaciones sensibles del modulo: gerencia, tecnico.
- RN-MANT-002: Los cambios de estado deben respetar la secuencia de negocio definida por la logica actual del modulo.
- RN-MANT-003: Las operaciones del modulo deben persistir informacion en las tablas asociadas manteniendo consistencia de datos.
- RN-MANT-004: Las integraciones externas del modulo deben ejecutarse con tolerancia a fallos y trazabilidad de incidencias.
- RN-MANT-005: [Funcionalidad detectada en el sistema] Se identifican reglas implicitas implementadas en servicios/controladores que deben formalizarse en el FRS.

## 10. Dependencias con otros modulos
- Documentos
- Gestion de Archivos
- Notificaciones
- Integraciones externas detectadas: Correo corporativo, Eventos en tiempo real, Generacion documental PDF, Google OAuth/Drive.

