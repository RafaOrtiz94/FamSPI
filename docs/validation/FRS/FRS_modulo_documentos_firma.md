# FRS — MÓDULO DE DOCUMENTOS Y FIRMA

**Sistema:** FamSPI
**Versión:** 2.0
**Fecha:** 2026-06-18
**Estado:** En revisión
**Alineación:** WHO TRS 1019, Annex 3, Appendix 5

---

## 1. Introducción

Este documento especifica el comportamiento funcional observable de los submódulos `documents`, `files` y `signature` (FamSign) del sistema FamSPI. Cada especificación describe el endpoint real, los parámetros que recibe, el proceso que ejecuta en backend y la respuesta que devuelve. Las especificaciones se derivan directamente del código fuente: `documents.controller.js`, `document.service.js`, `files.controller.js`, `file.service.js` y `signature.controller.js`.

## 2. Descripción Funcional

El módulo opera sobre tres capas coordinadas:

- **`documents`**: Genera documentos Google Docs desde plantilla Drive, inserta firmas en posición mediante tags `{{TAG}}`, aplica firma avanzada con consentimiento y exporta el resultado a PDF.
- **`files`**: Recibe archivos multipart vía `multer` (almacenados temporalmente en `/tmp`), los sube a Google Drive y registra los metadatos en `request_attachments`. Permite listado, descarga como stream y eliminación con control de rol.
- **`signature` / FamSign**: Implementa el flujo de firma criptográfica avanzada: calcula SHA-256 del PDF, registra en `document_signatures_advanced`, llama a la función SQL `create_document_seal_and_qr()`, genera QR con URL pública y bloquea el documento de forma irreversible. La verificación pública opera sin sesión con rate limit.

Todos los flujos de escritura utilizan transacciones PostgreSQL (`BEGIN / COMMIT / ROLLBACK`). Las operaciones de firma avanzada son atómicas: si cualquier paso falla, se hace ROLLBACK completo.

## 3. Especificaciones Funcionales

### FRS-DOC-001 — Crear documento desde plantilla

- **Endpoint:** `POST /api/v1/documents/from-template`
- **Middleware:** `verifyToken`, `requireRole(["tecnico", "comercial", "gerencia"])`
- **Entradas (body):**

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `request_id` | integer | Sí | ID de la solicitud origen en tabla `requests` |
| `template_id` | string | Sí | ID del documento plantilla en Google Drive |
| `folder_id` | string | No | ID de carpeta Drive destino; si se omite, se crea `REQ-{request_id}` |
| `title` | string | No | Nombre del documento; default `Documento-REQ-{request_id}` |
| `data` | object | No | Pares `{tag: valor}` para reemplazo de texto en el documento |
| `images` | object | No | Pares `{tag: base64}` para inserción de imágenes en posición |

- **Proceso:**
  1. Se abre transacción PostgreSQL.
  2. Se resuelve la carpeta Drive (usa `folder_id` recibido o crea una nueva con `createFolder()`).
  3. Se copia la plantilla con `copyTemplate(template_id, name, folder)`.
  4. Se reemplazan etiquetas de texto con `replaceTags(doc.id, data)`.
  5. Para cada entrada en `images`, se sube la imagen base64 a Drive, se ubica el tag `{{TAG}}` en el body del documento con `findTagRange()` y se reemplaza con `insertInlineImage` vía `docs.documents.batchUpdate()`.
  6. Se inserta en `documents` con `request_id`, `doc_drive_id`, `folder_drive_id`, `version_number` (heredado de `requests.version_number`) y `signed = false`.
  7. Se hace COMMIT.
  8. Se registra en auditoría (`logAction`, módulo `documents`, acción `crear_desde_plantilla`).

- **Salida exitosa (`201`):**
```json
{
  "ok": true,
  "document": {
    "id": 42,
    "doc_drive_id": "1aBcDeFgHiJkLmNoPqRsTuV",
    "folder_drive_id": "0A1B2C3D4E5F6G7H8I9J",
    "link": "https://drive.google.com/file/d/1aBcDeFgHiJkLmNoPqRsTuV/view"
  }
}
```

---

### FRS-DOC-002 — Insertar firma posicionada por tag

- **Endpoint:** `POST /api/v1/documents/:documentId/sign`
- **Middleware:** `verifyToken`, `requireRole(["tecnico", "gerencia"])`
- **Entradas:**

| Campo | Origen | Descripción |
|---|---|---|
| `documentId` | path param | ID local o `doc_drive_id` del documento |
| `base64` | body | Imagen de firma en base64 |
| `tag` | body | Nombre del tag sin llaves (ej. `FIRMA_RESPONSABLE`) |
| `role_at_sign` | body | Rol con el que firma (opcional, se persiste en `document_signatures.role_at_sign`) |

- **Proceso:**
  1. Se consulta `documents` por `id` o por `doc_drive_id` ($1 en ambas condiciones).
  2. Se sube la imagen base64 a Drive como `{tag}.png` en `folder_drive_id`.
  3. Se obtiene el body del documento con `docs.documents.get()` y se localiza el tag `{{TAG}}` con `findTagRange()`.
  4. Se ejecuta `docs.documents.batchUpdate()` con dos operaciones atómicas: `deleteContentRange` + `insertInlineImage`.
  5. Se inserta en `document_signatures` con `document_id`, `signer_user_id` (de JWT), `role_at_sign` y `signed_at = now()`.
  6. Se actualiza `documents SET signed = true, updated_at = now()`.
  7. Se registra en auditoría (acción `firmar_tag`).

- **Salida exitosa (`200`):**
```json
{
  "ok": true,
  "result": {
    "document_id": 42,
    "doc_drive_id": "1aBcDeFgHiJkLmNoPqRsTuV"
  }
}
```

---

### FRS-DOC-003 — Firma avanzada desde módulo `documents`

- **Endpoint:** `POST /api/v1/documents/:documentId/sign-advanced`
- **Middleware:** `verifyToken`, `requireRole(["tecnico", "gerencia"])`
- **Entradas (body):**

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `consent` | boolean | Sí | Debe ser `true`; cualquier otro valor retorna `400` |
| `consent_text` | string | Sí | Texto del consentimiento expresado por el firmante |
| `role_at_sign` | string | No | Rol funcional con el que se firma |
| `authorized_role` | string | No | Rol para el sello institucional |
| `session_id` | string | Sí | ID de sesión para trazabilidad; ausencia retorna `400` |

- **Proceso:**
  1. Validación de `consent === true` y `session_id` no vacío (validaciones sincrónicas en controlador).
  2. Captura de `ip` desde `x-forwarded-for` o `req.ip`, y `user-agent` del header.
  3. Delegación a `svc.applyAdvancedSignature()` que abre transacción y:
     - Exporta el documento a PDF y descarga el buffer desde Drive.
     - Calcula hash SHA-256 del buffer via `documentHashService.createHash()`.
     - Registra firma en `document_signatures_advanced` via `advancedSignatureService.signDocument()`.
     - Aplica sello via `digitalSealService.applySeal()`.
     - Hace COMMIT.
  4. Genera QR con `QRCode.toDataURL(verificationUrl)`.

- **Salida exitosa (`201`):**
```json
{
  "ok": true,
  "hash": { "id": 7, "hash_sha256": "abc123..." },
  "signature": { "id": 3, "signed_at": "2026-06-18T14:00:00Z" },
  "seal": { "verification_token": "tok_xxx", "verification_url": "https://...", "qr": "data:image/png;base64,..." },
  "pdf": { "id": "pdfDriveId", "link": "https://drive.google.com/..." }
}
```

---

### FRS-DOC-004 — Exportar documento a PDF

- **Endpoint:** `POST /api/v1/documents/:documentId/export-pdf`
- **Middleware:** `verifyToken`, `requireRole(["tecnico", "gerencia"])`
- **Entradas:** `documentId` (path param — ID local o `doc_drive_id`)

- **Proceso:**
  1. Se detecta si `documentId` es un ID Drive (regex `/^[a-zA-Z0-9_-]{20,}$/`) o un ID local.
  2. Se consulta `documents` por el campo correspondiente.
  3. Se llama `exportPdfUtil(doc.doc_drive_id, doc.folder_drive_id)` que exporta el Docs a PDF en Drive.
  4. Se actualiza `documents SET pdf_drive_id = $1, updated_at = now()`.
  5. Se registra en auditoría (acción `exportar_pdf`).

- **Salida exitosa (`200`):**
```json
{
  "ok": true,
  "pdf": {
    "id": "pdfDriveFileId",
    "link": "https://drive.google.com/..."
  }
}
```

---

### FRS-DOC-005 — Consultar documentos de una solicitud / obtener documento individual

- **Endpoints:**
  - `GET /api/v1/documents/by-request/:requestId` — Lista documentos por solicitud
  - `GET /api/v1/documents/:documentId` — Recupera un documento por ID

- **Middleware:** `verifyToken` (sin restricción de rol)

- **Proceso (listado):** `SELECT * FROM documents WHERE request_id = $1 ORDER BY created_at DESC`
- **Proceso (individual):** `SELECT * FROM documents WHERE id = $1 OR doc_drive_id = $1`

- **Salida (listado):**
```json
{ "ok": true, "rows": [ { ...documento } ] }
```
- **Salida (individual):** `404` si no existe; `200` con `{ "ok": true, "document": { ... } }` si existe.

---

### FRS-DOC-006 — Subir adjuntos por solicitud

- **Endpoint:** `POST /api/v1/files/upload/:requestId`
- **Middleware:** `verifyToken`, `requireRole(["tecnico", "comercial", "gerencia"])`, `multer.array("files")` (almacenamiento temporal en `/tmp`)
- **Entradas:** Archivos multipart en campo `files`; `requestId` en path param.

- **Proceso:**
  1. Valida que `req.files` tenga al menos un elemento; si no, retorna `400`.
  2. Por cada archivo: convierte el buffer a `Readable` stream y llama `drive.files.create()` con `parents: [DRIVE_ATTACHMENTS_FOLDER_ID]`.
  3. Inserta en `request_attachments`: `request_id`, `drive_file_id`, `filename`, `mimetype`, `mime_type`, `uploaded_by`, `drive_link`, `size`, `title`.
  4. Registra en auditoría (módulo `files`, acción `subir`).

- **Salida exitosa (`201`):**
```json
{
  "ok": true,
  "uploaded": [
    { "id": "driveId", "name": "contrato.pdf", "mimeType": "application/pdf", "driveLink": "https://...", "size": 204800 }
  ]
}
```

---

### FRS-DOC-007 — Listar adjuntos por solicitud

- **Endpoint:** `GET /api/v1/files/by-request/:requestId`
- **Middleware:** `verifyToken`, `requireRole(["tecnico", "comercial", "gerencia"])`

- **Proceso:** `SELECT id, drive_file_id, filename, title, COALESCE(mime_type, mimetype), drive_link, uploaded_by, size, created_at FROM request_attachments WHERE request_id = $1 ORDER BY created_at DESC`

- **Salida:**
```json
{
  "ok": true,
  "files": [
    { "id": 5, "drive_file_id": "abc", "filename": "orden.pdf", "uploaded_at": "2026-06-18T10:00:00Z", ... }
  ]
}
```

---

### FRS-DOC-008 — Obtener metadatos y descargar adjunto

- **Endpoints:**
  - `GET /api/v1/files/:fileId/metadata` — Metadatos desde Drive API
  - `GET /api/v1/files/:fileId/download` — Stream de descarga

- **Middleware:** `verifyToken`

- **Proceso (metadatos):** `drive.files.get({ fileId, fields: "id,name,mimeType,size,createdTime,webViewLink,owners,modifiedTime" })`
- **Proceso (descarga):** `drive.files.get({ fileId, alt: "media" }, { responseType: "stream" })` + headers `Content-Type` y `Content-Disposition: attachment`.

---

### FRS-DOC-009 — Eliminar adjunto

- **Endpoint:** `DELETE /api/v1/files/:fileId`
- **Middleware:** `verifyToken`, `requireRole(["gerencia", "admin"])`

- **Proceso:**
  1. `drive.files.delete({ fileId, supportsAllDrives: true })` — elimina de Drive.
  2. `DELETE FROM request_attachments WHERE drive_file_id = $1 RETURNING request_id`.
  3. Registra en auditoría (acción `eliminar`).

- **Salida exitosa (`200`):**
```json
{ "ok": true, "message": "Archivo eliminado correctamente." }
```

---

### FRS-DOC-010 — Firma avanzada FamSign (submódulo `signature`)

- **Endpoint:** `POST /api/signature/documents/:documentId/sign`
- **Middleware:** `verifyToken`
- **Entradas (body):**

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `document_base64` | string | Sí | PDF del documento en base64; ausencia retorna `400` |
| `consent` | boolean | Sí | Debe ser `true` |
| `role_at_sign` | string | Sí | Rol funcional del firmante |
| `authorized_role` | string | Sí | Rol para el sello; ausencia retorna `400` |
| `session_id` | string | Sí | En body o header `x-session-id` |

- **Proceso completo (transaccional):**
  1. `validateSignatureRequest()` — valida todos los campos obligatorios.
  2. `assertSignatureDependencies(["sealGenerator"])` — verifica que `create_document_seal_and_qr()` existe en PostgreSQL.
  3. Verifica que el usuario tiene email (`req.user.email`); sin email retorna `422`.
  4. Convierte `document_base64` a buffer con `Buffer.from(base64, "base64")`.
  5. Abre transacción PostgreSQL.
  6. Verifica existencia del documento en `documents`.
  7. `calculateDocumentHash()`: invalida hash previo con `UPDATE document_hashes SET is_current = FALSE`, calcula SHA-256 del buffer, inserta en `document_hashes`.
  8. `updateDocumentWithHash()`: actualiza `documents SET current_hash_id = $1, signature_status = 'PENDING'`.
  9. `createAdvancedSignature()`: inserta en `document_signatures_advanced` con `signer_name`, `signer_email`, `signer_department`, `ip_address`, `user_agent`, `session_id`, `auth_method = 'OAUTH_CORPORATE'`, `signature_hash = SHA256(documentId:hashId:userId:sessionId)`, `is_valid = TRUE`.
  10. `createSealAndQR()`: llama `SELECT * FROM create_document_seal_and_qr($1, $2, $3)`.
  11. `getSealAndQRInfo()`: recupera `seal_code`, `verification_token`, `qr_url` de `document_seals` + `document_qr_codes`.
  12. `generateQRCode()`: genera QR como `data:image/png;base64,...` con URL `PUBLIC_BASE_URL/verificar/{token}`.
  13. `lockDocument()`: `UPDATE documents SET is_locked = TRUE, signed = TRUE, locked_at = NOW(), locked_by = $1, signature_status = 'SIGNED'`.
  14. COMMIT.

- **Salida exitosa (`201`):**
```json
{
  "ok": true,
  "message": "Firma aplicada y documento bloqueado",
  "data": {
    "document_id": 42,
    "hash": { "id": 7, "value": "sha256hex...", "algorithm": "SHA-256" },
    "signature": { "id": 3, "signed_at": "2026-06-18T14:00:00Z", "signer": "Juan Pérez", "role": "tecnico" },
    "seal": { "id": 1, "code": "SEAL-2026-001", "verification_token": "tok_abc123" },
    "qr": { "id": 1, "url": "https://spi.famproject.app/verificar/tok_abc123", "image": "data:image/png;base64,..." }
  }
}
```

---

### FRS-DOC-011 — Verificación pública por token QR

- **Endpoints:** `GET /api/signature/verificar/:token` y `GET /api/signature/verify/:token`
- **Middleware:** `verificationLimiter` (60 req / 5 min por IP) — **sin `verifyToken`**

- **Proceso:**
  1. Consulta vista `document_verification_info WHERE verification_token = $1 AND qr_active = TRUE`.
  2. Si no hay resultado, retorna `404`.
  3. Si `dependencyStatus.qrTracker` es `true`, llama `SELECT track_qr_access($1)` para incrementar `access_count`.
  4. Retorna estado de verificación completo.

- **Salida exitosa (`200`):**
```json
{
  "ok": true,
  "verification": {
    "document_id": 42,
    "signature_status": "SIGNED",
    "is_locked": true,
    "is_valid": true,
    "hash": { "value": "sha256hex...", "algorithm": "SHA-256", "calculated_at": "2026-06-18T14:00:00Z" },
    "signature": { "signed_at": "...", "signer_name": "Juan Pérez", "signer_role": "tecnico" },
    "seal": { "code": "SEAL-2026-001", "authorized_role": "gerencia", "is_active": true },
    "qr": { "verification_token": "tok_abc123", "access_count": 3, "is_active": true }
  }
}
```

---

### FRS-DOC-012 — Audit trail de firma de un documento

- **Endpoint:** `GET /api/signature/documents/:documentId/audit-trail`
- **Middleware:** `verifyToken`

- **Control de acceso adicional (en controlador):**
  - Consulta `documents` + `document_signatures_advanced` para obtener `signer_user_id` y `locked_by`.
  - Solo el firmante (`req.user.id === signer_user_id`), el usuario que bloqueó (`locked_by`) o un `admin`/`administrador` puede acceder; de lo contrario retorna `403`.
  - Los roles `admin`/`administrador` se detectan con `collectRoles(req.user)` que agrega `user.role`, `user.scope` y `user.roles[]`.

- **Proceso:** `SELECT id, event_type, event_description, user_name, user_role, ip_address, user_agent, session_id, event_hash, previous_event_hash, event_data, event_timestamp FROM document_signature_logs WHERE document_id = $1 ORDER BY event_timestamp ASC, id ASC`

- **Salida:**
```json
{
  "ok": true,
  "document_id": 42,
  "audit_trail": [
    { "event_type": "HASH_CALCULATED", "event_hash": "abc...", "previous_event_hash": "", "user_name": "Juan Pérez", ... }
  ]
}
```

---

### FRS-DOC-013 — Dashboard de métricas de firma

- **Endpoint:** `GET /api/signature/dashboard`
- **Middleware:** `verifyToken`

- **Proceso:** Tres consultas paralelas sobre `documents` y `document_signature_logs`.

- **Salida:**
```json
{
  "ok": true,
  "dashboard": {
    "total_documents": 120,
    "signed_documents": 95,
    "locked_documents": 95,
    "avg_signing_time_hours": 2.4,
    "status_distribution": [{ "signature_status": "SIGNED", "count": "95" }],
    "recent_activity": [ { "event_type": "DOCUMENT_LOCKED", "user_name": "...", "event_timestamp": "..." } ]
  }
}
```

---

## 4. Tabla de Endpoints Completos

| Método | Ruta | Módulo | Roles permitidos | Auth requerida |
|---|---|---|---|---|
| POST | `/api/v1/documents/from-template` | documents | tecnico, comercial, gerencia | JWT |
| POST | `/api/v1/documents/:documentId/sign` | documents | tecnico, gerencia | JWT |
| POST | `/api/v1/documents/:documentId/sign-advanced` | documents | tecnico, gerencia | JWT |
| POST | `/api/v1/documents/:documentId/export-pdf` | documents | tecnico, gerencia | JWT |
| GET | `/api/v1/documents/by-request/:requestId` | documents | todos autenticados | JWT |
| GET | `/api/v1/documents/:documentId` | documents | todos autenticados | JWT |
| POST | `/api/v1/files/upload/:requestId` | files | tecnico, comercial, gerencia | JWT |
| GET | `/api/v1/files/by-request/:requestId` | files | tecnico, comercial, gerencia | JWT |
| GET | `/api/v1/files/:fileId/metadata` | files | todos autenticados | JWT |
| GET | `/api/v1/files/:fileId/download` | files | todos autenticados | JWT |
| DELETE | `/api/v1/files/:fileId` | files | gerencia, admin | JWT |
| POST | `/api/signature/documents/:documentId/sign` | signature | todos autenticados | JWT |
| GET | `/api/signature/verificar/:token` | signature | público | Ninguna (rate limit) |
| GET | `/api/signature/verify/:token` | signature | público | Ninguna (rate limit) |
| GET | `/api/signature/documents/:documentId/audit-trail` | signature | firmante / admin | JWT + lógica interna |
| GET | `/api/signature/dashboard` | signature | todos autenticados | JWT |

> **Nota sobre aliases:** `signature.routes.js` registra rutas duplicadas con y sin prefijo `/signature/` para compatibilidad hacia atrás (ej. `POST /api/signature/signature/documents/:documentId/sign`). Estos aliases no están en `signature.v1.routes.js`.

## 5. Controles de Acceso

| Middleware / Guard | Archivo | Función |
|---|---|---|
| `verifyToken` | `backend/src/middlewares/auth.js` | Valida JWT de todas las solicitudes autenticadas |
| `requireRole([roles])` | `backend/src/middlewares/roles.js` | Restringe endpoint a los roles declarados |
| `verificationLimiter` | `signature.controller.js` (inline) | `express-rate-limit`: 60 req / 5 min por IP en verificación pública |
| `assertSignatureDependencies()` | `signatureSchema.service.js` | Verifica existencia de funciones SQL antes de ejecutar firma; retorna `503` si faltan |
| `collectRoles(user)` | `signature.controller.js` (inline) | Agrega `role`, `scope` y `roles[]` del JWT para decisiones de autorización en audit trail |

## 6. Dependencias Funcionales

| Dependencia | Tipo | Detalle |
|---|---|---|
| Google Drive API | Externa | Copia de plantillas, subida de adjuntos, exportación PDF, descarga de streams |
| Google Docs API | Externa | Lectura de body del documento, reemplazo de tags, inserción de imágenes |
| PostgreSQL función `create_document_seal_and_qr()` | SQL interna | Genera registro en `document_seals` y `document_qr_codes`; verificada en runtime |
| PostgreSQL función `track_qr_access()` | SQL interna | Incrementa `access_count`; su ausencia no falla la verificación |
| Vista `document_verification_info` | SQL interna | Fuente de datos de verificación pública |
| `logAction()` (utils/audit) | Transversal | Persiste eventos en bitácora central del sistema |
| `multer` | NPM | Manejo de uploads multipart; almacenamiento temporal en `/tmp` |
| `qrcode` | NPM | Generación de QR como `data:image/png;base64,...` |
| `express-rate-limit` | NPM | Rate limiting en endpoint de verificación pública |

## 7. Observaciones Técnicas

1. **Dos flujos de firma avanzada coexisten:** `POST /api/v1/documents/:documentId/sign-advanced` (en `document.service.js`) y `POST /api/signature/documents/:documentId/sign` (en `signature.controller.js`). Ambos exigen consentimiento y `session_id`, pero el flujo del módulo `signature` es más completo: incluye `validateSignatureRequest()`, `assertSignatureDependencies()`, validación de email y bloqueo explícito del documento.

2. **Detección de ID Drive vs. ID local:** `document.service.js → exportPdf()` distingue ambos tipos con el regex `/^[a-zA-Z0-9_-]{20,}$/`. Esto aplica también en `signAtTag()` que busca por `id = $1 OR doc_drive_id = $1`.

3. **Multer almacena en `/tmp`:** Los archivos subidos se escriben temporalmente en disco en lugar de memoria. En contenedores efímeros, esto puede ser riesgoso si `/tmp` no persiste entre solicitudes largas.

4. **Dependencias SQL verificadas en runtime:** `assertSignatureDependencies()` usa un caché de 60 segundos (`CACHE_TTL_MS`). Si las funciones SQL no están disponibles, el endpoint retorna `503` con `code: "SIGNATURE_SCHEMA_MISSING"`.

5. **Rate limit sin autenticación:** El endpoint de verificación pública aplica `verificationLimiter` pero no `verifyToken`, permitiendo el acceso externo. El rate limit es la única barrera de abuso.
