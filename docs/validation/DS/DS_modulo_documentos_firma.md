# DOCUMENTO DE DISENO DEL SISTEMA (DS)

## Nombre del modulo
Documentos, Archivos y Firma Digital

## Arquitectura del modulo
- Capa de presentacion: frontend React o consumidores internos del SPI.
- Capa API: rutas Express bajo prefijos del backend.
- Capa de negocio: controladores y servicios del modulo.
- Capa de persistencia: consultas SQL directas y tablas asociadas.
- Capa transversal: autenticacion, autorizacion, auditoria y notificaciones cuando aplica.

## Componentes del sistema
### Controladores
- `backend/src/modules/documents/documents.controller.js`
- `backend/src/modules/files/files.controller.js`
- `backend/src/modules/signature/signature.controller.js`

### Servicios
- `backend/src/modules/documents/document.service.js`
- `backend/src/modules/files/file.service.js`

### Modelos
- Sin ORM; SQL directo y funciones DB para sellado/verificacion.

### Rutas
- `backend/src/modules/documents/documents.routes.js`
- `backend/src/modules/files/files.routes.js`
- `backend/src/modules/signature/signature.routes.js`

### Componentes de interfaz
- `spi_front/src/core/api/documentsApi.js`
- `spi_front/src/core/api/filesApi.js`
- `spi_front/src/core/api/signatureApi.js`
- `spi_front/src/modules/signature/components/DocumentSigner.jsx`
- `spi_front/src/modules/signature/pages/DocumentVerification.jsx`
- `spi_front/src/modules/signature/pages/SignatureDashboard.jsx`

## Modelo de datos asociado
- `documents`
- `document_signatures`
- `request_attachments`
- `document_hashes`
- `document_signatures_advanced`
- `document_seals`
- `document_qr_codes`
- `document_signature_logs`

## Interfaces API
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

## Dependencias tecnicas
- Autenticacion y Sesiones.
- Comercial y Gestion de Clientes.
- Servicio Tecnico y Mantenimientos.
- Talento Humano y Gestion de Personal.
- Notificaciones y Comunicaciones.

## Controles de seguridad y operacion
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

## Riesgos tecnicos detectados
- Dependencia de Drive para disponibilidad de documentos.
- Divergencia entre flujo de firma simple (`documents`) y firma avanzada (`signature`).
- Exposicion publica de verificacion requiere control de tasa y monitoreo.
- Eliminacion de adjuntos puede afectar evidencia de auditoria si no hay retencion definida.

## Diagrama tecnico
`mermaid
flowchart LR
  UI[Frontend o consumidor] --> API[API DOC]
  API --> CTRL[Controladores]
  CTRL --> SVC[Servicios]
  SVC --> DB[(Base de datos)]
  SVC --> EXT[Dependencias externas o modulos transversales]
`
