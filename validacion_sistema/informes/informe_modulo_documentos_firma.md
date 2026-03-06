# INFORME DE VALIDACION DEL MODULO

## Nombre del modulo
Documentos, Archivos y Firma Digital

## Descripcion del modulo
Gestiona la evidencia documental de procesos internos: creacion de documentos desde plantilla, carga de adjuntos por solicitud y firma digital avanzada con verificacion publica.

## Alcance funcional
- Creacion de documentos en Drive a partir de plantilla.
- Insercion de firma por tag y firma avanzada.
- Exportacion de documento firmado a PDF.
- Carga, listado, descarga y eliminacion de adjuntos por solicitud.
- Verificacion publica de autenticidad por token/QR.
- Consulta de audit trail y metricas de firma.

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

## Endpoints de API
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

## Tablas de base de datos asociadas
- `documents`
- `document_signatures`
- `request_attachments`
- `document_hashes`
- `document_signatures_advanced`
- `document_seals`
- `document_qr_codes`
- `document_signature_logs`

## Dependencias con otros modulos
- Autenticacion y Sesiones.
- Comercial y Gestion de Clientes.
- Servicio Tecnico y Mantenimientos.
- Talento Humano y Gestion de Personal.
- Notificaciones y Comunicaciones.

## Controles de seguridad
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

## Riesgos operativos
- Dependencia de Drive para disponibilidad de documentos.
- Divergencia entre flujo de firma simple (`documents`) y firma avanzada (`signature`).
- Exposicion publica de verificacion requiere control de tasa y monitoreo.
- Eliminacion de adjuntos puede afectar evidencia de auditoria si no hay retencion definida.

## Posibles escenarios de falla
- Documento no encontrado por diferencia entre `id` local y `doc_drive_id`.
- Firma avanzada fallida por inconsistencia de hash o datos de consentimiento.
- Descarga de archivo sin permiso valido.
- Token de verificacion publico expirado o inexistente.

## Nivel de criticidad
ALTO

## Prioridad de validacion
MEDIA-ALTA

---

## BASE DOCUMENTAL PARA VALIDACION

## Requerimientos del usuario (URS)
- `URS-DOC-001`: El sistema debe permitir generar documentos de proceso desde plantillas.
- `URS-DOC-002`: El sistema debe permitir registrar firma digital y exportar documento final.
- `URS-DOC-003`: El sistema debe permitir gestionar adjuntos por solicitud.
- `URS-DOC-004`: El sistema debe permitir verificar autenticidad documental por token publico.
- `URS-DOC-005`: El sistema debe conservar trazabilidad completa de firmas y cambios.

## Requerimientos funcionales
- `RF-DOC-001`: Crear documento y asociarlo a solicitud origen.
- `RF-DOC-002`: Registrar firma por tag y firma avanzada con sello/QR.
- `RF-DOC-003`: Gestionar ciclo de vida de adjuntos (`upload`, `list`, `download`, `delete`).
- `RF-DOC-004`: Exponer audit trail y dashboard de firma digital.
- `RF-DOC-005`: Mantener control de permisos por rol en operaciones sensibles.

## Resumen del diseno tecnico
- Tres submodulos coordinados: `documents`, `files`, `signature`.
- Persistencia SQL + integracion Drive/Docs para artefactos.
- Endpoints privados y endpoint publico de verificacion.
- Frontend con dashboard y visor de firma/verificacion.

## Escenarios de prueba
### Funcionalidad
- Caso: Crear documento desde plantilla y exportar PDF tras firma.
- Resultado esperado: Documento persistido, firmado y PDF generado con metadatos.

### Seguridad
- Caso: Usuario no autorizado intenta eliminar adjunto.
- Resultado esperado: `403` y archivo sin modificaciones.

### Manejo de errores
- Caso: Fallo de Drive al subir adjunto.
- Resultado esperado: Error controlado y sin registro inconsistente en `request_attachments`.

### Integridad de datos
- Caso: Verificar documento con token QR.
- Resultado esperado: Coincidencia de hash/sello y estado `VERIFIED`.

---

## MATRIZ DE TRAZABILIDAD

| Requerimiento | Componente | Prueba |
|---|---|---|
| REQ-DOC-001 Documento desde plantilla | `document.service.createFromTemplate` | Crear documento y validar registro en `documents` |
| REQ-DOC-002 Firma y PDF | `document.service.signAtTag` + `signature.controller.signDocument` | Firmar y exportar, validar hash/sello |
| REQ-DOC-003 Adjuntos por solicitud | `file.service.uploadFiles/list/delete` | Subir, listar, descargar y eliminar adjunto |
| REQ-DOC-004 Verificacion publica | `signature.controller.verifyDocument` | Consultar token valido e invalido |
| REQ-DOC-005 Trazabilidad | `signature.controller.getDocumentAuditTrail` | Validar secuencia de eventos de firma |
