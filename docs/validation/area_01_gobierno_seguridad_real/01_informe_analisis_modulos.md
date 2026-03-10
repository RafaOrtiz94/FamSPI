# INFORME DE ANALISIS DE MODULOS

## 1. Alcance y evidencia utilizada
- Area analizada: Gobierno, Seguridad y Cumplimiento.
- Modulos revisados: `auth`, `security`, `auditoria`, `audit-prep`, `approvals`, `management`, `signature`.
- Fuentes de evidencia directa: `backend/src/app.js`, `backend/src/modules/*`, `backend/src/middlewares/*`, `backend/src/utils/audit.js`, `spi_front/src/core/api/*`, `spi_front/src/core/auth/*`, `spi_front/src/modules/*`, `backend/src/actualsindatos.sql`.
- Estado del repositorio: no existe el directorio `backend/src/migrations`; el esquema verificable en este analisis proviene de `backend/src/actualsindatos.sql`.
- Regla aplicada: si una conducta no pudo verificarse en codigo, se marca como `DESCONOCIDO`.

## 2. Hallazgos globales del area
- `auth`, `auditoria`, `audit-prep`, `approvals`, `management` y `signature` si estan montados en `backend/src/app.js`.
- `security` existe en codigo, pero no esta montado en `backend/src/app.js`; en runtime sus endpoints no quedan expuestos.
- Existen dos implementaciones distintas de `requireRole`: `middlewares/auth.js` y `middlewares/roles.js`. Esto genera semanticas de autorizacion inconsistentes.
- `signature` usa un prefijo real `/api/*`, mientras el frontend consume `/api/signature/*`.
- `management` y partes de `audit-prep` usan tablas o columnas que no coinciden con `actualsindatos.sql`.

## 3. Modulo `auth`
### 3.1 Informe de estructura del modulo
- Controladores: `backend/src/modules/auth/auth.controller.js`.
- Servicios/repositorios: `backend/src/modules/auth/session.repository.js`.
- Rutas: `backend/src/modules/auth/auth.routes.js`, montadas en `backend/src/app.js:191` bajo `/api/v1/auth`.
- Middlewares utilizados:
  - Global: `verifyToken` en `backend/src/app.js:200-213` para rutas privadas.
  - Local: `verifyToken` y `requireRole` desde `backend/src/middlewares/auth.js` en `auth.routes.js`.
- Tablas utilizadas: `users`, `departments`, `user_profile`, `user_sessions`, `user_lopdp_consents`, `user_attendance_records`.
- Integraciones externas: Google OAuth (`config/oauth`), Google Drive (`utils/drive`), geolocalizacion (`utils/geoip`), politica off-hours (`utils/offHoursPolicy`), notificaciones (`modules/notifications/notifications.service`).
- Frontend consumidor:
  - `spi_front/src/core/api/authApi.js`
  - `spi_front/src/core/auth/AuthContext.jsx`
  - `spi_front/src/core/auth/ProtectedRoute.jsx`
  - `spi_front/src/modules/shared/pages/Login.jsx`
  - `spi_front/src/modules/shared/pages/LoginCallback.jsx`
  - `spi_front/src/modules/shared/pages/FirstLoginSignature.jsx`
  - `spi_front/src/core/ui/widgets/InternalLopdpConsentModal.jsx`
  - vistas TI/Gerencia que consultan `/auth/sessions`.
- Jobs/colas: no expone jobs propios. Delegacion indirecta a la cola de notificaciones cuando detecta login fuera de horario.

### 3.2 Informe de comportamiento funcional
- Endpoints expuestos:
  - `GET /api/v1/auth/google`
  - `GET /api/v1/auth/google/callback`
  - `GET /api/v1/auth/me`
  - `POST /api/v1/auth/refresh`
  - `POST /api/v1/auth/logout`
  - `POST /api/v1/auth/lopdp/accept`
  - `GET /api/v1/auth/sessions`
  - `GET /api/v1/auth/active-users`
- Logica real:
  - Redirecciona a Google OAuth y procesa el `code` del callback.
  - Crea o actualiza usuarios por `google_id` o `email`.
  - Firma `accessToken` por 8h y `refreshToken` por 7d.
  - Registra sesiones en `user_sessions`.
  - Detecta login fuera de horario y notifica a TI.
  - Inserta auditoria manual en `auditoria.logs` para login exitoso y off-hours login.
  - En `/auth/me` consulta perfil y ejecuta auto clock-in sobre `user_attendance_records` si no existe marcacion del dia.
  - `refresh` renueva tokens sin validar que el refresh token siga activo en `user_sessions`.
  - `logout` cierra sesiones por email o por refresh token.
  - `lopdp/accept` sube firma PNG y PDF a Drive, actualiza `users` e inserta historial en `user_lopdp_consents`.
- Validaciones y seguridad:
  - Verificacion de email confirmado por Google.
  - Restriccion de dominio por `ALLOWED_DOMAIN`.
  - `verifyToken` en `me`, `logout`, `lopdp/accept`, `sessions`, `active-users`.
  - `sessions` y `active-users` usan `requireRole` de `middlewares/auth.js`; este control esta defectuoso y es bypassable para roles fuera de su jerarquia codificada.
- Operaciones BD relevantes:
  - `SELECT/UPDATE/INSERT` sobre `users` y `departments`.
  - `INSERT/UPDATE` sobre `user_sessions`.
  - `SELECT/INSERT ... ON CONFLICT` sobre `user_attendance_records`.
  - `UPDATE` sobre `users` e `INSERT` sobre `user_lopdp_consents`.
- Manejo de errores:
  - El callback devuelve redirecciones con `error=*`.
  - `/me` responde `401`, `404` o `500`.
  - `/refresh` responde `401` ante token invalido o expirado.
  - `/logout` responde `500` si falla el cierre.
- Efectos secundarios:
  - Creacion/actualizacion de usuarios.
  - Creacion/rotacion/cierre de sesiones.
  - Registro de auditoria.
  - Notificacion a TI por login off-hours.
  - Escritura transversal en asistencia desde un endpoint de lectura.

## 4. Modulo `security`
### 4.1 Informe de estructura del modulo
- Controladores: `backend/src/modules/security/security.controller.js`.
- Servicios/utilidades auxiliares:
  - `backend/src/modules/security/security.privacy.js`
  - `backend/src/modules/security/security.siem.js`
  - `backend/src/modules/security/security.whitelist.js`
  - `backend/src/modules/security/security.holidays.ec.js`
- Rutas: `backend/src/modules/security/security.routes.js`.
- Montaje en app: `NO MONTADO`. No existe `app.use("/api/v1/security", ...)` en `backend/src/app.js`.
- Middlewares utilizados en el router:
  - `verifyToken` y `requireRole(['ti'])` desde `middlewares/auth.js`.
  - Guard de entorno para `/dev/*`.
- Tablas utilizadas por el controlador montable: `auditoria.logs`, `notifications`, `users`, `departments`, `user_sessions`.
- Tablas utilizadas por codigo auxiliar no integrado: `security_offhours_whitelist`, `security_jobs_log`.
- Integraciones externas: potencial webhook SIEM via `node-fetch`; en el flujo real revisado no existe llamada desde `auth` ni desde `security.routes`.
- Frontend consumidor: `DESCONOCIDO`. No se encontro cliente API ni pagina React consumiendo `/security/*`.
- Jobs/colas: ninguno montado. SIEM y whitelist son helpers sin conexion al flujo principal.

### 4.2 Informe de comportamiento funcional
- Endpoints definidos en el router:
  - `POST /api/v1/security/dev/emit-offhours` solo en entornos dev permitidos y si `SECURITY_DEV_EMITTER_ENABLED`.
  - `GET /api/v1/security/offhours-logins`
  - `GET /api/v1/security/offhours-logins/:id/timeline`
  - `POST /api/v1/security/offhours-logins/:id/review`
  - `GET /api/v1/security/offhours-logins/export`
- Comportamiento real en runtime: como el modulo no esta montado, esos endpoints responden `404` desde la aplicacion principal.
- Logica codificada en controlador:
  - Consulta eventos `auth.offhours_login` desde `auditoria.logs`.
  - Cruza eventos con `notifications` para inferir estado `pending/reviewed`.
  - Sanitiza IP y `user-agent` antes de responder o exportar.
  - Marca notificaciones de seguridad como leidas al revisar un evento.
  - Exporta CSV o JSON segun query param `format`.
- Validaciones y seguridad:
  - El router pretende restringir todo a rol `ti`, pero usa `middlewares/auth.js`, cuyo `requireRole` es inseguro para roles fuera de la jerarquia declarada.
- Operaciones BD relevantes:
  - `SELECT` sobre `auditoria.logs`, `notifications`, `users`, `departments`, `user_sessions`.
  - `UPDATE notifications SET status='read', read_at=NOW()` en revision.
  - `INSERT` de auditoria via `logAction`.
- Manejo de errores:
  - El controlador retorna `500` si fallan consultas o export.
  - El endpoint timeline contiene referencias a `created_en` en lugar de `creado_en`, lo que produciria error SQL si el modulo estuviera montado.
- Efectos secundarios:
  - Revisa notificaciones y registra auditoria secundaria de revision/export.
  - No hay evidencia de envio SIEM ni uso de whitelist en el flujo real.

## 5. Modulo `auditoria`
### 5.1 Informe de estructura del modulo
- Controladores: `backend/src/modules/auditoria/audit.controller.js`.
- Servicios: `backend/src/modules/auditoria/auditoria.service.js`.
- Rutas: `backend/src/modules/auditoria/audit.routes.js`, montadas en `backend/src/app.js:232` bajo `/api/v1/auditoria`.
- Middlewares utilizados:
  - `verifyToken` global en `app.js`.
  - `requireRole` desde `backend/src/middlewares/roles.js` en `audit.routes.js`.
- Tablas utilizadas: `auditoria.logs`.
- Integraciones externas: generacion CSV via `csv-stringify/sync`.
- Frontend consumidor:
  - `spi_front/src/core/api/auditoriaApi.js`
  - `spi_front/src/modules/gerencia/Auditoria.jsx`
  - `spi_front/src/modules/auditoria/components/AuditoriaPreview.jsx`
- Jobs/colas: no aplica.

### 5.2 Informe de comportamiento funcional
- Endpoints expuestos:
  - `GET /api/v1/auditoria`
  - `GET /api/v1/auditoria/:id`
  - `GET /api/v1/auditoria/export/csv`
- Logica real:
  - Lista auditorias con filtros por usuario, email, modulo, accion, fechas y contexto (`request_id`, `mantenimiento_id`, `inventario_id`, `auto`).
  - Pagina resultados y limita `limit` a maximo 500.
  - Exporta hasta 10000 filas a CSV con delimitador `;`.
- Validaciones y seguridad:
  - Roles permitidos en listado/detalle: `ti`, `gerencia`, `talento_humano`.
  - Export CSV restringido a `ti` y `gerencia`.
- Operaciones BD: `SELECT` y `COUNT` sobre `auditoria.logs`.
- Manejo de errores: `404` para log inexistente; `500` por fallo del servicio.
- Efectos secundarios: ninguno fuera de logging aplicativo.

## 6. Modulo `audit-prep`
### 6.1 Informe de estructura del modulo
- Controladores: `backend/src/modules/audit-prep/auditPrep.controller.js`.
- Servicios: `backend/src/modules/audit-prep/auditPrep.service.js`.
- Rutas: `backend/src/modules/audit-prep/auditPrep.routes.js`, montadas en `backend/src/app.js:233` bajo `/api/v1/audit-prep`.
- Middlewares utilizados:
  - `verifyToken` global en `app.js`.
  - `requireRole` desde `middlewares/auth.js` para `status`, `sections` y `external-access` administrativos.
- Tablas utilizadas: `audit_settings`, `audit_sections`, `audit_documents`, `audit_access_grants`, `users`.
- Integraciones externas: Google Drive (`ensureFolder`, `uploadBase64File`, `drive.files.get`).
- Frontend consumidor:
  - `spi_front/src/core/api/auditPrepApi.js`
  - `spi_front/src/modules/audit-prep/AuditPrepPage.jsx`
- Jobs/colas: no aplica.

### 6.2 Informe de comportamiento funcional
- Endpoints expuestos:
  - `GET /api/v1/audit-prep/status`
  - `PUT /api/v1/audit-prep/status`
  - `GET /api/v1/audit-prep/sections`
  - `POST /api/v1/audit-prep/sections`
  - `GET /api/v1/audit-prep/documents`
  - `POST /api/v1/audit-prep/documents/upload`
  - `PATCH /api/v1/audit-prep/documents/:id/status`
  - `GET /api/v1/audit-prep/documents/:id/download`
  - `GET/POST/DELETE /api/v1/audit-prep/external-access`
- Logica real:
  - Crea `audit_settings` si no existe fila `id=1`.
  - Activa/desactiva `audit_mode` y, al desactivar, revoca todos los accesos externos activos.
  - Filtra secciones y documentos por `allowed_roles`, con bypass explicito para `gerencia`, `admin_ti`, `jefe_ti`.
  - Valida carga base64 de documentos y limita MIME/size.
  - Crea raiz Drive de auditoria y carpetas por `storage_path`.
  - Limita a 2 accesos externos activos.
- Validaciones y seguridad:
  - `status`, `sections` y `external-access` administrativos restringidos por `requireRole` defectuoso de `middlewares/auth.js`.
  - `uploadDocument` exige `audit_mode` activo y seccion permitida.
  - `downloadDocument` exige `audit_mode` activo, salvo `gerencia`, `admin_ti`, `jefe_ti`.
- Operaciones BD relevantes:
  - `SELECT/INSERT/UPDATE` sobre `audit_settings`.
  - `INSERT ... ON CONFLICT` sobre `audit_sections`.
  - `INSERT/UPDATE/SELECT` sobre `audit_documents`.
  - `INSERT/UPDATE/SELECT COUNT(*)` sobre `audit_access_grants`.
- Manejo de errores:
  - `400` por payload incompleto o estado invalido.
  - `403` por seccion no permitida.
  - `409` cuando auditoria no esta activa.
  - `413` y `415` en validacion de archivos.
- Efectos secundarios:
  - Escritura en Drive.
  - Auditoria via `logAction`.
- Defecto funcional visible en codigo:
  - `listDocuments` usa `u.nombre_completo` aunque `users` define `fullname`; con el esquema verificado, ese endpoint falla.

## 7. Modulo `approvals`
### 7.1 Informe de estructura del modulo
- Controladores: `backend/src/modules/approvals/approvals.controller.js`.
- Servicios: `backend/src/modules/approvals/approvals.service.js`.
- Rutas: `backend/src/modules/approvals/approvals.routes.js`, montadas en `backend/src/app.js:228` bajo `/api/v1/approvals`.
- Middlewares utilizados:
  - `verifyToken` desde `middlewares/auth.js` por ruta.
  - `requireRole` desde `middlewares/roles.js`.
- Tablas utilizadas: `requests`, `request_types`, `users`, `request_approvals`.
- Integraciones externas: `sendMail`, mas notificaciones indirectas desde `requests.service.updateRequestStatus`.
- Frontend consumidor:
  - `spi_front/src/core/api/approvalsApi.js`
  - `spi_front/src/modules/servicio/pages/Aprobaciones.jsx`
  - `spi_front/src/modules/servicio/components/PendingApprovals.jsx`
  - `spi_front/src/modules/servicio/pages/Dashboard.jsx`
- Jobs/colas: no hay jobs dedicados. El correo se dispara con `setImmediate`.

### 7.2 Informe de comportamiento funcional
- Endpoints expuestos:
  - `GET /api/v1/approvals/pending`
  - `POST /api/v1/approvals/:id/approve`
  - `POST /api/v1/approvals/:id/reject`
- Logica real:
  - `listPending` devuelve toda solicitud cuyo `status` no este en estados finales, sin filtrar por tipo ni por cola del rol recibido.
  - `approve` y `reject` abren transaccion, actualizan `requests.status`, insertan `request_approvals` y envian correo.
  - La aprobacion usa estado `aprobado`; el rechazo usa `rechazado`.
- Validaciones y seguridad:
  - `pending` admite roles `tecnico`, `gerencia`, `calidad`, `jefe_calidad`, `jefe_servicio_tecnico`, `jefe_tecnico`.
  - `approve/reject` restringidos a `jefe_servicio_tecnico` y `jefe_tecnico`.
- Operaciones BD:
  - `SELECT` sobre `requests`, `request_types`, `users`.
  - `INSERT` sobre `request_approvals`.
  - `UPDATE requests` via `requests.service.updateRequestStatus`.
  - `BEGIN/COMMIT/ROLLBACK` en aprobar y rechazar.
- Manejo de errores:
  - Si la transaccion falla, hace rollback y lanza error 500.
- Efectos secundarios:
  - Correo asincrono.
  - Notificaciones automati cas a traves de `requests.service`.
  - Intento de auditoria via `audit.logAction`, pero con firma de parametros incorrecta.

## 8. Modulo `management`
### 8.1 Informe de estructura del modulo
- Controladores: `backend/src/modules/management/management.controller.js`.
- Servicios: `backend/src/modules/management/management.service.js`.
- Rutas: `backend/src/modules/management/management.routes.js`, montadas en `backend/src/app.js:234` bajo `/api/v1/management`.
- Middlewares utilizados:
  - `verifyToken` desde `middlewares/auth.js`.
  - `requireRole` desde `middlewares/roles.js` con `gerente_general` y `admin`.
- Tablas utilizadas por consultas activas y latentes: `requests`, `request_types`, `users`, `request_versions`, y ademas referencias a `audit_logs` y `attachments` que no existen en `actualsindatos.sql`.
- Integraciones externas: ninguna verificada.
- Frontend consumidor: `DESCONOCIDO`. No se encontro cliente API ni vista React que llame `/management/*`.
- Jobs/colas: no aplica.

### 8.2 Informe de comportamiento funcional
- Endpoints expuestos:
  - `GET /api/v1/management/stats`
  - `GET /api/v1/management/requests`
  - `GET /api/v1/management/trace/:id`
  - `GET /api/v1/management/documents/:id`
- Logica real:
  - `stats` usa `management.service.getStats()` para contar solicitudes y calcular promedio de tiempo.
  - `requests` ejecuta SQL directamente en el controlador y lista maximo 200 solicitudes.
  - `trace/:id` y `documents/:id` delegan al servicio.
- Validaciones y seguridad:
  - Todo el modulo queda restringido a `gerente_general` o `admin`.
- Operaciones BD:
  - `getStats` consulta `requests` y `request_types`, pero filtra estados ingleses `approved/rejected` que no existen en el `CHECK` de `requests`.
  - `getTrace` consulta `audit_logs`, tabla no presente en el esquema verificado.
  - `getDocuments` consulta `attachments`, tabla no presente; la tabla real es `request_attachments`.
  - El metodo `listRequests` del servicio usa `u.nombre_completo`, columna inexistente en `users`.
- Manejo de errores:
  - Los errores en servicio/controlador retornan `500` con mensaje generico.
- Efectos secundarios: no aplica.

## 9. Modulo `signature`
### 9.1 Informe de estructura del modulo
- Controladores: `backend/src/modules/signature/signature.controller.js`.
- Servicios dedicados: no existe archivo de servicio; la logica esta concentrada en el controlador.
- Rutas: `backend/src/modules/signature/signature.routes.js`, montadas en `backend/src/app.js:263` bajo `/api`.
- Middlewares utilizados:
  - `verifyToken` para firmar, ver audit trail y dashboard.
  - `rateLimit` especifico para verificacion publica.
- Tablas y vistas utilizadas: `documents`, `document_hashes`, `document_signatures_advanced`, `document_seals`, `document_qr_codes`, `document_signature_logs`, vista `document_verification_info`.
- Funciones SQL utilizadas: `create_document_seal_and_qr`, `track_qr_access`, `get_document_audit_trail`.
- Integraciones externas: generacion QR (`qrcode`), hash SHA-256 (`crypto`).
- Frontend consumidor:
  - `spi_front/src/core/api/signatureApi.js`
  - `spi_front/src/modules/signature/components/DocumentSigner.jsx`
  - `spi_front/src/modules/signature/pages/DocumentVerification.jsx`
  - `spi_front/src/modules/signature/pages/SignatureDashboard.jsx`
  - componentes de servicio tecnico que embeben `DocumentSigner`.
- Jobs/colas: no aplica.

### 9.2 Informe de comportamiento funcional
- Endpoints expuestos en backend real:
  - `POST /api/documents/:documentId/sign`
  - `GET /api/verificar/:token`
  - `GET /api/documents/:documentId/audit-trail`
  - `GET /api/dashboard`
  - `GET /api/verify/:token` (alias legacy)
- Logica codificada:
  - `signDocument` valida `document_base64` y `consent`, calcula hash, intenta insertar firma avanzada, crea sello y QR, y bloquea el documento dentro de una transaccion.
  - `verifyDocument` consulta `document_verification_info` y aumenta el contador de accesos QR.
  - `getDocumentAuditTrail` limita acceso al firmante o a usuarios `admin` segun `req.user.roles`.
  - `getSignatureDashboard` agrega metricas sobre `documents` y actividad reciente desde `document_signature_logs`.
- Validaciones y seguridad:
  - `verifyToken` en endpoints privados.
  - `rateLimit` para verificacion publica.
  - Validacion basica del payload de firma.
- Operaciones BD:
  - `BEGIN/COMMIT/ROLLBACK` en la firma.
  - `INSERT` en `document_hashes`.
  - `UPDATE documents` para `current_hash_id`, `signature_status`, `is_locked`.
  - `SELECT` sobre vista `document_verification_info`.
  - `SELECT` sobre funcion `get_document_audit_trail`.
- Manejo de errores:
  - `404` para token o documento inexistente.
  - `403` para audit trail no autorizado.
  - `500` ante errores internos.
- Efectos secundarios y defectos operativos:
  - La insercion en `document_signatures_advanced` no coincide con el esquema verificado: usa `consent_text`, omite `signer_email` y depende de `req.user.name`.
  - El frontend consume `/api/signature/*`, pero el backend real expone `/api/*`; la UI de firma no coincide con el montaje real.
  - `DocumentSigner` se monta como ruta `/dashboard/signatures/:documentId/sign`, pero el componente no usa `useParams` y espera `documentId` por props.

## 10. Conclusiones tecnicas del analisis modular
- `auth` esta funcional, pero mezcla autenticacion con asistencia y tiene una debilidad critica en refresco/revocacion de sesiones.
- `security` no esta operativo en runtime y, aun si se montara, contiene fallas de autorizacion y errores SQL.
- `auditoria` es el modulo mas consistente del area.
- `audit-prep` implementa un flujo real de evidencia documental, pero su administracion esta expuesta por un RBAC defectuoso y su listado documental no cuadra con el esquema.
- `approvals` funciona de forma acotada para solicitudes tecnicas, no como motor jerarquico general del area.
- `management` esta parcialmente implementado y contiene endpoints que fallan por referencias a tablas/columnas inexistentes.
- `signature` presenta la mayor brecha entre intencion y operacion real: el backend, el esquema y el frontend no estan alineados.
