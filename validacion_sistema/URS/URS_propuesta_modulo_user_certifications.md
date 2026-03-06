# DOCUMENTO DE PROPUESTA DE REQUERIMIENTOS DEL SISTEMA (URS)
## Modulo: Certificaciones de Usuario

## 1. Introduccion
Este documento presenta la propuesta de requerimientos del modulo Certificaciones de Usuario del Sistema de Procesos Internos SPI, elaborada mediante ingenieria inversa del codigo fuente vigente.

## 2. Objetivo del modulo
Definir y controlar las capacidades funcionales que el sistema debe ofrecer en el ambito de Certificaciones de Usuario para soportar procesos internos del negocio.

## 3. Alcance funcional
- Gestion de capacidades de negocio implementadas en el modulo Certificaciones de Usuario.
- Ejecucion de flujos CRUD/transaccionales soportados por rutas y servicios actuales.
- Consumo de componentes frontend vinculados y contratos API del backend.
- Aplicacion de controles de seguridad, validacion y trazabilidad detectados en el codigo.

## 4. Actores del sistema
- Acp Comercial
- Gerencia
- Gerencia General
- Servicios/integraciones externas del modulo
- Talento Humano
- Usuario autenticado del proceso interno

## 5. Descripcion general del modulo
El modulo Certificaciones de Usuario se implementa principalmente en backend/src/modules/user-certifications y se integra con la arquitectura API del sistema mediante rutas, controladores y servicios. Su comportamiento funcional actual se apoya en validaciones de entrada, control de permisos y trazabilidad operativa.

## 6. Funcionalidades identificadas
- Operacion API detectada: DELETE /me/certifications/:certId.
- Operacion API detectada: GET /:id/certifications.
- Operacion API detectada: GET /:id/certifications/pdf.
- Operacion API detectada: GET /me/certifications.
- Operacion API detectada: POST /me/certifications.
- Operacion API detectada: POST /me/certifications/bulk.
- [Funcionalidad detectada en el sistema] Persistencia/transaccion sobre tablas: auditoria, user_certifications, users.

### Endpoints de API detectados
- DELETE /me/certifications/:certId
- GET /:id/certifications
- GET /:id/certifications/pdf
- GET /me/certifications
- POST /me/certifications
- POST /me/certifications/bulk

### Componentes del sistema
- backend\src\modules\user-certifications\userCertifications.controller.js
- backend\src\modules\user-certifications\userCertifications.routes.js
- backend\src\modules\user-certifications\userCertifications.service.js

### Componentes frontend relacionados
- spi_front\src\core\api\userCertificationsApi.js

### Tablas/entidades de datos detectadas
- auditoria
- user_certifications
- users

## 7. Requerimientos funcionales de alto nivel
- REQ-USCE-001: El sistema debe permitir consultar y listar informacion operativa del modulo Certificaciones de Usuario segun los permisos del actor.
- REQ-USCE-002: El sistema debe permitir registrar nuevas operaciones/transacciones del modulo Certificaciones de Usuario con validaciones de entrada.
- REQ-USCE-003: El sistema debe permitir ejecutar eliminaciones controladas del modulo Certificaciones de Usuario cuando el flujo de negocio lo permita.
- REQ-USCE-004: El sistema debe permitir generar salidas de control (reportes, resumenes o metricas) para seguimiento del modulo Certificaciones de Usuario.
- REQ-USCE-005: El sistema debe interoperar con integraciones externas del modulo Certificaciones de Usuario: Eventos en tiempo real, Generacion documental PDF, Google OAuth/Drive.

## 8. Requerimientos no funcionales
- RNF-USCE-001: El modulo debe aplicar control de acceso por autenticacion y autorizacion acorde a la sensibilidad del proceso.
- RNF-USCE-002: El modulo debe mantener integridad de datos en operaciones de escritura, con manejo transaccional cuando aplique.
- RNF-USCE-003: El modulo debe registrar trazabilidad/auditoria de acciones criticas para soporte de control interno.
- RNF-USCE-004: El modulo debe gestionar errores de forma estandarizada, devolviendo codigos y mensajes tecnicos consumibles por frontend.
- RNF-USCE-005: El modulo debe proteger datos sensibles en transito y en almacenamiento, segun politicas de seguridad del sistema.
- RNF-USCE-006: El modulo debe sostener rendimiento operativo en consultas y operaciones frecuentes del proceso.
- RNF-USCE-007: El modulo debe soportar disponibilidad operativa para jornadas internas y continuidad de procesos.
- RNF-USCE-008: El modulo debe ser mantenible, con separacion clara de rutas, controladores y servicios en el codigo actual.

## 9. Reglas de negocio
- RN-USCE-001: Solo los roles autorizados pueden ejecutar operaciones sensibles del modulo: acp_comercial, gerencia, gerencia_general, talento_humano.
- RN-USCE-002: Las operaciones del modulo deben persistir informacion en las tablas asociadas manteniendo consistencia de datos.
- RN-USCE-003: Las integraciones externas del modulo deben ejecutarse con tolerancia a fallos y trazabilidad de incidencias.
- RN-USCE-004: [Funcionalidad detectada en el sistema] Se identifican reglas implicitas implementadas en servicios/controladores que deben formalizarse en el FRS.

## 10. Dependencias con otros modulos
- El modulo opera con acoplamiento interno minimo; no se detectaron dependencias directas explicitas hacia otros modulos de negocio.
- Integraciones externas detectadas: Eventos en tiempo real, Generacion documental PDF, Google OAuth/Drive.

