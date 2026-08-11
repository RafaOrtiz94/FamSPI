# DOCUMENTO DE ESPECIFICACION FUNCIONAL DEL SISTEMA (FRS)

## Nombre del modulo
Documentos, Archivos y Firma Digital

## Descripcion funcional
Gestiona la evidencia documental de procesos internos: creacion de documentos desde plantilla, carga de adjuntos por solicitud y firma digital avanzada con verificacion publica.

## Logica funcional observada
- Creacion de documentos en Drive a partir de plantilla.
- Insercion de firma por tag y firma avanzada.
- Exportacion de documento firmado a PDF.
- Carga, listado, descarga y eliminacion de adjuntos por solicitud.
- Verificacion publica de autenticidad por token/QR.
- Consulta de audit trail y metricas de firma.

## Especificaciones funcionales
### FRS-DOC-001
**Descripcion:** Creacion de documentos en Drive a partir de plantilla.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-DOC-002
**Descripcion:** Insercion de firma por tag y firma avanzada.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-DOC-003
**Descripcion:** Exportacion de documento firmado a PDF.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-DOC-004
**Descripcion:** Carga, listado, descarga y eliminacion de adjuntos por solicitud.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-DOC-005
**Descripcion:** Verificacion publica de autenticidad por token/QR.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

### FRS-DOC-006
**Descripcion:** Consulta de audit trail y metricas de firma.

**Entradas:** Solicitud API o accion de usuario autenticado, parametros del proceso y datos del modulo.

**Proceso:** El backend aplica autenticacion, autorizacion, validaciones de negocio, persistencia o consulta de datos y registro de trazabilidad segun el flujo observado.

**Salida:** Resultado funcional del proceso, cambio de estado o respuesta consultiva del modulo.

## Endpoints API relacionados
### Documentos
- `POST /api/v1/documents/from-template`
- `POST /api/v1/documents/:documentId/sign`
- `POST /api/v1/documents/:documentId/sign-advanced`
- `POST /api/v1/documents/:documentId/export-pdf`
- `GET /api/v1/documents/by-request/:requestId`
- `GET /api/v1/documents/:documentId`

### Archivos
- `POST /api/v1/files/upload/:requestId`
- `GET /api/v1/files/by-request/:requestId`
- `GET /api/v1/files/:fileId/metadata`
- `GET /api/v1/files/:fileId/download`
- `DELETE /api/v1/files/:fileId`

### Firma digital (FamSign)
- `POST /api/signature/documents/:documentId/sign`
- `GET /api/signature/verificar/:token`
- `GET /api/signature/verify/:token`
- `GET /api/signature/documents/:documentId/audit-trail`
- `GET /api/signature/dashboard`

## Validaciones y controles funcionales
### Control de acceso
- JWT obligatorio para operaciones privadas de documentos y firma.
- Control por rol en creacion, firma y eliminacion de adjuntos.

### Autenticacion
- Verificacion publica por token para consulta externa.
- Resto de endpoints exigen usuario autenticado.

### Autorizacion
- Restricciones por rol (`tecnico`, `comercial`, `gerencia`, `admin`) segun operacion.

### Registro de auditoria
- Registro de firmas, hash, sellado y eventos de verificacion.
- Audit trail por documento para validacion forense.

### Proteccion de datos
- Uso de hash SHA-256 para integridad de documento.
- Sello/QR institucional para validacion de autenticidad.
- Carga controlada de archivos con metadatos de trazabilidad.

## Dependencias funcionales
- Autenticacion y Sesiones.
- Comercial y Gestion de Clientes.
- Servicio Tecnico y Mantenimientos.
- Talento Humano y Gestion de Personal.
- Notificaciones y Comunicaciones.

## Observaciones
- Dependencia de Drive para disponibilidad de documentos.
- Divergencia entre flujo de firma simple (`documents`) y firma avanzada (`signature`).
- Exposicion publica de verificacion requiere control de tasa y monitoreo.
- Eliminacion de adjuntos puede afectar evidencia de auditoria si no hay retencion definida.
