# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Integracion Gmail

## 1. Introduccion
Este documento presenta la propuesta de requerimientos del modulo Integracion Gmail del Sistema de Procesos Internos SPI, elaborada mediante ingenieria inversa del codigo fuente vigente.

## 2. Objetivo del modulo
Definir y controlar las capacidades funcionales que el sistema debe ofrecer en el ambito de Integracion Gmail para soportar procesos internos del negocio.

## 3. Alcance funcional
- Gestion de capacidades de negocio implementadas en el modulo Integracion Gmail.
- Ejecucion de flujos CRUD/transaccionales soportados por rutas y servicios actuales.
- Consumo de componentes frontend vinculados y contratos API del backend.
- Aplicacion de controles de seguridad, validacion y trazabilidad detectados en el codigo.

## 4. Actores del sistema
- Servicios/integraciones externas del modulo
- Usuario autenticado del proceso interno

## 5. Descripcion general del modulo
El modulo Integracion Gmail se implementa principalmente en backend/src/modules/gmail y se integra con la arquitectura API del sistema mediante rutas, controladores y servicios. Su comportamiento funcional actual se apoya en validaciones de entrada, control de permisos y trazabilidad operativa.

## 6. Funcionalidades identificadas
- Operacion API detectada: DELETE /auth/revoke.
- Operacion API detectada: GET /auth/callback.
- Operacion API detectada: GET /auth/status.
- Operacion API detectada: GET /auth/url.
- Operacion API detectada: POST /send.
- [Funcionalidad detectada en el sistema] Persistencia/transaccion sobre tablas: users.

### Endpoints de API detectados
- DELETE /auth/revoke
- GET /auth/callback
- GET /auth/status
- GET /auth/url
- POST /send

### Componentes del sistema
- backend\src\modules\gmail\gmail.controller.js
- backend\src\modules\gmail\gmail.routes.js

### Componentes frontend relacionados
- No se identificaron referencias frontend directas para este modulo.

### Tablas/entidades de datos detectadas
- users

## 7. Requerimientos funcionales de alto nivel
- REQ-GMAI-001: El sistema debe permitir consultar y listar informacion operativa del modulo Integracion Gmail segun los permisos del actor.
- REQ-GMAI-002: El sistema debe permitir registrar nuevas operaciones/transacciones del modulo Integracion Gmail con validaciones de entrada.
- REQ-GMAI-003: El sistema debe permitir ejecutar eliminaciones controladas del modulo Integracion Gmail cuando el flujo de negocio lo permita.
- REQ-GMAI-004: El sistema debe controlar cambios de estado/aprobacion del proceso en Integracion Gmail segun reglas y roles definidos.
- REQ-GMAI-005: El sistema debe interoperar con integraciones externas del modulo Integracion Gmail: Correo corporativo, Google OAuth/Drive.

## 8. Requerimientos no funcionales
- RNF-GMAI-001: El modulo debe aplicar control de acceso por autenticacion y autorizacion acorde a la sensibilidad del proceso.
- RNF-GMAI-002: El modulo debe mantener integridad de datos en operaciones de escritura, con manejo transaccional cuando aplique.
- RNF-GMAI-003: El modulo debe registrar trazabilidad/auditoria de acciones criticas para soporte de control interno.
- RNF-GMAI-004: El modulo debe gestionar errores de forma estandarizada, devolviendo codigos y mensajes tecnicos consumibles por frontend.
- RNF-GMAI-005: El modulo debe proteger datos sensibles en transito y en almacenamiento, segun politicas de seguridad del sistema.
- RNF-GMAI-006: El modulo debe sostener rendimiento operativo en consultas y operaciones frecuentes del proceso.
- RNF-GMAI-007: El modulo debe soportar disponibilidad operativa para jornadas internas y continuidad de procesos.
- RNF-GMAI-008: El modulo debe ser mantenible, con separacion clara de rutas, controladores y servicios en el codigo actual.

## 9. Reglas de negocio
- RN-GMAI-001: Las operaciones del modulo deben ejecutarse solo por actores autenticados con permisos efectivos del contexto.
- RN-GMAI-002: Los cambios de estado deben respetar la secuencia de negocio definida por la logica actual del modulo.
- RN-GMAI-003: Las operaciones del modulo deben persistir informacion en las tablas asociadas manteniendo consistencia de datos.
- RN-GMAI-004: Las integraciones externas del modulo deben ejecutarse con tolerancia a fallos y trazabilidad de incidencias.
- RN-GMAI-005: [Funcionalidad detectada en el sistema] Se identifican reglas implicitas implementadas en servicios/controladores que deben formalizarse en el FRS.

## 10. Dependencias con otros modulos
- El modulo opera con acoplamiento interno minimo; no se detectaron dependencias directas explicitas hacia otros modulos de negocio.
- Integraciones externas detectadas: Correo corporativo, Google OAuth/Drive.

