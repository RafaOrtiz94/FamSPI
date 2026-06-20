# URS — MÓDULO DE DOCUMENTOS Y FIRMA

**Sistema:** FamSPI
**Versión:** 2.0
**Fecha:** 2026-06-18
**Estado:** En revisión
**Alineación:** WHO TRS 1019, Annex 3, Appendix 5

---

## 1. Introducción

El módulo de Documentos y Firma cubre tres submódulos integrados del sistema FamSPI: `documents`, `files` y `signature` (FamSign). Juntos soportan el ciclo completo de evidencia documental de los procesos internos: generación de documentos controlados desde plantilla, custodia de adjuntos por solicitud y formalización de firma digital avanzada con verificación pública independiente del sistema.

La necesidad del módulo surge del requisito operativo de que cualquier solicitud de servicio, mantenimiento o proceso técnico deje evidencia documental trazable, íntegra y verificable. Sin estos componentes, el sistema no puede cerrar el ciclo de trazabilidad exigido por auditorías internas y por los marcos regulatorios aplicables.

## 2. Objetivo

Definir los requerimientos de usuario del submódulo `documents` (creación y firma posicionada), `files` (adjuntos por solicitud) y `signature` / FamSign (firma avanzada con hash SHA-256, sello institucional y QR de verificación pública), estableciendo qué capacidades deben existir, por qué son necesarias y cómo deben manifestarse en la operación.

## 3. Alcance

### Incluye

- Creación de documentos en Google Docs a partir de plantilla Drive, con reemplazo de etiquetas de texto e inserción de imágenes base64 en posición.
- Inserción de firma posicionada mediante tag `{{TAG}}` en el documento Drive.
- Firma avanzada FamSign: cálculo de hash SHA-256 del PDF exportado, registro en `document_signatures_advanced`, generación de sello via función `create_document_seal_and_qr()` y bloqueo irreversible del documento (`is_locked = TRUE`).
- Exportación del documento a PDF con registro del ID Drive resultante en `documents.pdf_drive_id`.
- Carga, listado, descarga y eliminación de adjuntos por solicitud (`request_attachments` + Google Drive).
- Verificación pública de autenticidad mediante token QR sin requerir sesión, con rate limit de 60 solicitudes por 5 minutos.
- Consulta de audit trail encadenado desde `document_signature_logs`.
- Dashboard de métricas de firma: documentos firmados, bloqueados y tiempo medio de firma.

### Excluye

- Infraestructura de Google Drive (carpetas, permisos de workspace).
- Generación de plantillas Drive; el sistema las consume, no las administra.
- Mecanismos de respaldo de base de datos.
- Flujos de negocio propios de otros módulos (aprobaciones, comercial, talento humano).

## 4. Actores

| Actor | Descripción | Submódulo principal |
|---|---|---|
| `tecnico` | Usuario técnico que genera documentos y firma en tag | `documents`, `files` |
| `comercial` | Usuario comercial que crea documentos y sube adjuntos | `documents`, `files` |
| `gerencia` | Rol con acceso a firma, exportación y eliminación de adjuntos | `documents`, `files`, `signature` |
| `admin` / `administrador` | Acceso total incluyendo eliminación de adjuntos y audit trail | `files`, `signature` |
| Usuario externo de verificación | Accede por token/QR sin sesión para validar autenticidad | `signature` (público) |

## 5. Justificación del módulo

| Submódulo | Por qué existe | Cómo opera a alto nivel | Cuándo aplica |
|---|---|---|---|
| `documents` | Para generar documentos operativos controlados desde plantilla | Copia plantilla Drive, reemplaza tags, inserta firmas posicionadas, exporta PDF | Cuando una solicitud necesita documento formalizable |
| `files` | Para custodiar adjuntos trazables por solicitud | Sube a Drive, registra en `request_attachments`, permite descarga y eliminación con control de rol | Cuando un flujo requiere anexos de evidencia |
| `signature` / FamSign | Para garantizar integridad y verificabilidad documental irreversible | Calcula hash SHA-256, registra firma avanzada, aplica sello institucional, genera QR público | Cuando un documento debe quedar formalizado con validez externa verificable |

## 6. Requerimientos Funcionales

### REQ-DOC-001 — Crear documento desde plantilla

- **Actor:** `tecnico`, `comercial`, `gerencia`
- **Enunciado:** El sistema debe permitir crear un documento en Google Docs copiando una plantilla Drive identificada por `template_id`, reemplazando etiquetas de texto (`data`) e insertando imágenes base64 en posición (`images`), y asociando el documento resultante a la solicitud de origen (`request_id`).
- **Resultado esperado:** Se retorna el ID local del documento, el `doc_drive_id`, el `folder_drive_id` y el enlace de visualización en Drive. El registro queda en la tabla `documents` con `signed = false`.
- **Criticidad:** Alta

### REQ-DOC-002 — Insertar firma posicionada por tag

- **Actor:** `tecnico`, `gerencia`
- **Enunciado:** El sistema debe permitir insertar una firma como imagen base64 en la posición del tag `{{TAG}}` dentro de un documento Google Docs existente, registrando el firmante, su rol y el momento de la firma en `document_signatures`.
- **Resultado esperado:** El tag es reemplazado por la imagen de firma, el documento queda con `signed = true` y el evento queda registrado en `document_signatures`.
- **Criticidad:** Alta

### REQ-DOC-003 — Firma avanzada FamSign

- **Actor:** `tecnico`, `gerencia`
- **Enunciado:** El sistema debe permitir firmar avanzadamente un documento, exigiendo consentimiento expreso (`consent = true`), texto de consentimiento (`consent_text`) y `session_id`. La firma debe calcular el hash SHA-256 del PDF exportado, registrar la firma en `document_signatures_advanced` con IP, `user_agent` y `auth_method = OAUTH_CORPORATE`, aplicar sello institucional mediante `create_document_seal_and_qr()`, generar QR con URL de verificación pública y bloquear el documento de forma irreversible (`is_locked = TRUE`, `signature_status = SIGNED`).
- **Resultado esperado:** Respuesta `201` con hash, firma, sello y QR. El documento queda bloqueado y no puede ser modificado.
- **Criticidad:** Alta

### REQ-DOC-004 — Exportar documento a PDF

- **Actor:** `tecnico`, `gerencia`
- **Enunciado:** El sistema debe permitir exportar un documento Google Docs a PDF, almacenarlo en Drive y registrar el `pdf_drive_id` en la tabla `documents`.
- **Resultado esperado:** Se retorna el ID del PDF en Drive y su enlace de descarga. El campo `pdf_drive_id` queda actualizado en `documents`.
- **Criticidad:** Media

### REQ-DOC-005 — Consultar documentos por solicitud

- **Actor:** Todo rol autenticado
- **Enunciado:** El sistema debe permitir listar todos los documentos asociados a una `request_id` y recuperar un documento individual por su ID local o por su `doc_drive_id`.
- **Resultado esperado:** Lista ordenada por `created_at DESC` o registro único con todos los campos de la tabla `documents`.
- **Criticidad:** Media

### REQ-DOC-006 — Subir adjuntos por solicitud

- **Actor:** `tecnico`, `comercial`, `gerencia`
- **Enunciado:** El sistema debe permitir subir uno o varios archivos adjuntos para una solicitud (`request_id`), almacenarlos en Google Drive bajo la carpeta configurada en `DRIVE_ATTACHMENTS_FOLDER_ID`, y registrar cada archivo en `request_attachments` con `drive_file_id`, `filename`, `mimetype`, `size`, `uploaded_by` y `drive_link`.
- **Resultado esperado:** Respuesta `201` con la lista de archivos subidos. El registro en `request_attachments` queda trazable.
- **Criticidad:** Alta

### REQ-DOC-007 — Listar, descargar y consultar metadatos de adjuntos

- **Actor:** `tecnico`, `comercial`, `gerencia`
- **Enunciado:** El sistema debe permitir listar adjuntos de una solicitud, obtener metadatos de Drive (`id`, `name`, `mimeType`, `size`, `createdTime`, `webViewLink`) y descargar el archivo como stream con los headers `Content-Type` y `Content-Disposition` correctos.
- **Resultado esperado:** Lista de adjuntos con `uploaded_at`, metadatos de Drive o stream de descarga según la operación solicitada.
- **Criticidad:** Media

### REQ-DOC-008 — Eliminar adjunto

- **Actor:** `gerencia`, `admin`
- **Enunciado:** El sistema debe permitir eliminar un adjunto borrándolo de Google Drive y de la tabla `request_attachments`, registrando la acción en el log de auditoría con `usuario_id`, `request_id` y acción `"eliminar"`.
- **Resultado esperado:** El archivo no existe en Drive ni en `request_attachments`. El log de auditoría refleja la eliminación.
- **Criticidad:** Media

### REQ-DOC-009 — Verificación pública por token QR

- **Actor:** Usuario externo (sin sesión)
- **Enunciado:** El sistema debe permitir verificar la autenticidad de un documento firmado mediante el token del QR, sin requerir autenticación, consultando la vista `document_verification_info`. El endpoint debe aplicar rate limit de 60 solicitudes por 5 minutos y registrar el acceso mediante `track_qr_access()`.
- **Resultado esperado:** Respuesta con `signature_status`, `is_locked`, hash SHA-256, datos del firmante, sello y estado del QR. Código `404` si el token no existe o el QR no está activo.
- **Criticidad:** Alta

### REQ-DOC-010 — Consultar audit trail de un documento

- **Actor:** Firmante original, usuario que bloqueó el documento, `admin`
- **Enunciado:** El sistema debe permitir consultar el historial encadenado de eventos de firma de un documento desde `document_signature_logs`, ordenado por `event_timestamp ASC`. El acceso debe restringirse al firmante, al usuario que bloqueó el documento o a un administrador.
- **Resultado esperado:** Lista de eventos con `event_type`, `event_hash`, `previous_event_hash`, `user_name`, `ip_address`, `session_id` y `event_data`.
- **Criticidad:** Alta

### REQ-DOC-011 — Dashboard de métricas de firma

- **Actor:** Todo rol autenticado
- **Enunciado:** El sistema debe exponer métricas agregadas de documentos firmados: total de documentos con `signature_status` no nulo, firmados (`SIGNED`), bloqueados (`is_locked = TRUE`), tiempo promedio de firma en horas y actividad reciente de `document_signature_logs`.
- **Resultado esperado:** Objeto `dashboard` con `total_documents`, `signed_documents`, `locked_documents`, `avg_signing_time_hours`, `status_distribution` y `recent_activity` (últimos 10 eventos).
- **Criticidad:** Baja

## 7. Requerimientos No Funcionales

### RNF-DOC-001 — Seguridad y control de acceso
Todos los endpoints privados deben exigir validación JWT mediante `verifyToken`. Las operaciones de creación, firma, exportación y eliminación deben validar rol con `requireRole`. El endpoint de verificación pública es la única excepción a la exigencia de sesión.

### RNF-DOC-002 — Integridad criptográfica
La firma avanzada FamSign debe calcular el hash SHA-256 del buffer del PDF real exportado desde Drive. El hash debe registrarse en `document_hashes` con `is_current = TRUE`, invalidando registros previos. La firma en `document_signatures_advanced` debe incluir `signature_hash` calculado como SHA-256 de `documentId:hashId:userId:sessionId`.

### RNF-DOC-003 — Trazabilidad inmutable
Los eventos de firma deben registrarse en `document_signature_logs` de forma encadenada: cada evento enlaza el `event_hash` del evento previo, siguiendo el patrón implementado en `ImmutableSignatureLogger.appendEvent()`. Esta cadena no debe poder modificarse (append-only).

### RNF-DOC-004 — Disponibilidad con control de errores
Las operaciones sobre Google Drive deben ejecutarse dentro de transacciones PostgreSQL con `BEGIN / COMMIT / ROLLBACK`. Un fallo de Drive no debe dejar registros inconsistentes en la base de datos.

### RNF-DOC-005 — Rate limit en verificación pública
El endpoint `GET /verificar/:token` y `GET /verify/:token` deben estar protegidos por `verificationLimiter` (60 req / 5 min) para prevenir abuso del sistema de verificación sin sesión.

### RNF-DOC-006 — Bloqueo irreversible post-firma
Una vez que FamSign aplica la firma avanzada, el documento debe quedar con `is_locked = TRUE` y `signature_status = SIGNED`. Ninguna operación posterior del flujo normal debe permitir modificar el documento bloqueado.

### RNF-DOC-007 — Consentimiento expreso para firma avanzada
Tanto el flujo `POST /documents/:documentId/sign-advanced` como `POST /signature/documents/:documentId/sign` deben rechazar con `400` si `consent !== true`. El `session_id` también es obligatorio; su ausencia devuelve `400`.

## 8. Reglas de Negocio

| # | Regla | Fuente en el código |
|---|---|---|
| RN-01 | Un documento puede buscarse por ID local o por `doc_drive_id` (formato Drive de 20+ caracteres). | `document.service.js → exportPdf()`, `signAtTag()` |
| RN-02 | La firma avanzada solo procede con `consent = true` y `session_id` no vacío. Ausencia de cualquiera retorna `400`. | `documents.controller.js → signAdvanced()`, `signature.controller.js → validateSignatureRequest()` |
| RN-03 | La firma avanzada requiere que el usuario tenga email registrado; sin email retorna `422`. | `signature.controller.js → signDocument()` |
| RN-04 | Al firmar con FamSign, el hash previo en `document_hashes` se marca `is_current = FALSE` antes de insertar el nuevo. | `signature.controller.js → calculateDocumentHash()` |
| RN-05 | El sello institucional se genera mediante la función SQL `create_document_seal_and_qr(documentId, authorizedRole, userId)`. | `signature.controller.js → createSealAndQR()` |
| RN-06 | El seguimiento de accesos QR depende de la disponibilidad de `track_qr_access()`. Si no existe, el acceso se registra con advertencia pero no falla. | `signature.controller.js → verifyDocument()` |
| RN-07 | La eliminación de adjuntos borra primero en Drive y luego en `request_attachments`. Un fallo en Drive aborta la operación. | `file.service.js → deleteFile()` |
| RN-08 | La carga de adjuntos requiere que exista al menos un archivo en la solicitud multipart; cero archivos retorna `400`. | `files.controller.js → uploadFiles()` |
| RN-09 | Los eventos en `document_signature_logs` son encadenados: cada `event_hash` se calcula como SHA-256 del hash previo concatenado con el payload del evento. | `immutableSignatureLogger.service.js → appendEvent()` |
| RN-10 | El acceso al audit trail está restringido: solo el firmante original (`signer_user_id`), el usuario que bloqueó el documento (`locked_by`) o un `admin`/`administrador` pueden consultarlo. | `signature.controller.js → getDocumentAuditTrail()` |

## 9. Dependencias con Otros Módulos

| Módulo | Tipo de dependencia | Detalle |
|---|---|---|
| `auth` | Transversal obligatoria | `verifyToken` valida el JWT en todos los endpoints privados |
| `requests` | Funcional | Los documentos y adjuntos se asocian a `request_id` de la tabla `requests` |
| `utils/audit` | Transversal | `logAction()` registra eventos en la bitácora de auditoría del sistema |
| Google Drive API | Infraestructura externa | Almacenamiento de documentos, adjuntos y exportaciones PDF |
| Google Docs API | Infraestructura externa | Copia de plantillas, reemplazo de tags e inserción de imágenes |
| `approvals` | Funcional indirecta | Los documentos de una solicitud pueden requerirse antes de que se procesen aprobaciones |

## 10. Conclusión

Los requerimientos del módulo de Documentos y Firma se justifican por la necesidad del sistema de mantener evidencia documental íntegra, custodia controlada de adjuntos y formalización de firmas con verificabilidad externa independiente. Los tres submódulos (`documents`, `files`, `signature`) operan coordinadamente sobre el mismo objeto raíz (`request_id`) y comparten el principio de que cada operación debe dejar traza auditable y no puede dejar el sistema en estado inconsistente.
