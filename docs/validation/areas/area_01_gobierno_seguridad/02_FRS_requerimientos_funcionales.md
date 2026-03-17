# FRS - AREA 01 GOBIERNO, SEGURIDAD Y CUMPLIMIENTO

## 1. Introduccion
Este FRS describe el comportamiento funcional verificable de los modulos del area 01 a partir del codigo actual.

## 2. Alcance funcional real
- `auth`: Google OAuth, JWT, refresh, logout, sesiones, LOPDP interna.
- `security`: consulta/revision/export de logins fuera de horario.
- `auditoria`: listado, detalle y export CSV.
- `audit-prep`: status, secciones, documentos, accesos externos.
- `approvals`: cola pendiente y decision del flujo tecnico.
- `management`: metricas, requests, trace y documents para gerencia.
- `signature`: firma, verificacion, audit trail y dashboard.

## 3. Requerimientos funcionales detallados
### FR-GSC-001 Autenticacion federada
- URS asociado: `REQ-GSC-001`
- Endpoint: `GET /api/v1/auth/google`, `GET /api/v1/auth/google/callback`
- Entradas: `code` OAuth en callback.
- Proceso:
  1. Intercambia `code` por tokens Google.
  2. Obtiene `userinfo`.
  3. Crea o actualiza usuario en `users`.
  4. Genera JWT de acceso y refresh.
  5. Inserta sesion en `user_sessions`.
  6. Ejecuta deteccion off-hours y log de auditoria.
  7. Redirige al frontend con tokens.
- Salida: redireccion al frontend o redireccion con `error=*`.

### FR-GSC-002 Perfil y sesion actual
- URS asociado: `REQ-GSC-002`, `REQ-GSC-003`
- Endpoint: `GET /api/v1/auth/me`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`
- Entradas: JWT y/o `x-refresh-token`.
- Proceso:
  - `me`: consulta `users`, `departments`, `user_profile`.
  - `refresh`: valida refresh token y exige coincidencia con sesion activa.
  - `logout`: cierra sesiones activas por email o refresh token.
- Salida: perfil, tokens renovados o confirmacion de cierre.

### FR-GSC-003 LOPDP interna
- URS asociado: `REQ-GSC-003`
- Endpoint: `POST /api/v1/auth/lopdp/accept`
- Entradas: `signature_base64`, `pdf_base64`, `accepted`, `notes`.
- Proceso:
  1. Valida aceptacion y archivos.
  2. Crea carpeta/persona/evidencias en Drive.
  3. Actualiza `users`.
  4. Inserta fila en `user_lopdp_consents`.
- Salida: usuario actualizado.

### FR-GSC-004 Monitoreo de seguridad off-hours
- URS asociado: `REQ-GSC-004`, `REQ-GSC-005`
- Endpoints:
  - `GET /api/v1/security/offhours-logins`
  - `GET /api/v1/security/offhours-logins/:id/timeline`
  - `POST /api/v1/security/offhours-logins/:id/review`
  - `GET /api/v1/security/offhours-logins/export`
- Proceso:
  - lee `auditoria.logs` filtrando `modulo='auth'` y `accion='offhours_login'`
  - enriquece con `notifications`, `users`, `departments`
  - marca revision sobre `notifications`
  - exporta CSV/JSON saneado
- Restriccion: acceso solo TI.

### FR-GSC-005 Consulta de auditoria
- URS asociado: `REQ-GSC-006`
- Endpoints:
  - `GET /api/v1/auditoria`
  - `GET /api/v1/auditoria/:id`
  - `GET /api/v1/auditoria/export/csv`
- Proceso:
  - filtra por usuario, modulo, accion, request, mantenimiento, inventario, fecha y `auto`
  - pagina resultados
  - exporta CSV a demanda

### FR-GSC-006 Preparacion de auditoria
- URS asociado: `REQ-GSC-007`, `REQ-GSC-008`, `REQ-GSC-009`, `REQ-GSC-010`
- Endpoints:
  - `GET/PUT /api/v1/audit-prep/status`
  - `GET/POST /api/v1/audit-prep/sections`
  - `GET/POST/PATCH /api/v1/audit-prep/documents*`
  - `GET/POST/DELETE /api/v1/audit-prep/external-access*`
- Proceso:
  - mantiene `audit_settings`
  - filtra `audit_sections` por rol
  - crea carpetas en Drive y registra `audit_documents`
  - limita accesos externos activos a dos

### FR-GSC-007 Aprobaciones operativas soportadas
- URS asociado: `REQ-GSC-011`, `REQ-GSC-012`
- Endpoints:
  - `GET /api/v1/approvals/pending`
  - `POST /api/v1/approvals/:id/approve`
  - `POST /api/v1/approvals/:id/reject`
- Proceso:
  - lista pendientes desde `requests`
  - aprueba o rechaza via `requests.service.updateRequestStatus`
  - registra decision en `request_approvals`
  - dispara correo
- Observacion: el alcance actual es tecnico/servicio, no corporativo transversal.

### FR-GSC-008 Gestion gerencial
- URS asociado: `REQ-GSC-013`, `REQ-GSC-014`
- Endpoints:
  - `GET /api/v1/management/stats`
  - `GET /api/v1/management/requests`
  - `GET /api/v1/management/trace/:id`
  - `GET /api/v1/management/documents/:id`
- Proceso:
  - agrega estadisticas de `requests`
  - lista solicitudes con `request_types` y `users`
  - consulta trazabilidad en `auditoria.logs`
  - consulta adjuntos y versiones en `request_attachments` y `request_versions`

### FR-GSC-009 Firma y verificacion documental
- URS asociado: `REQ-GSC-015`, `REQ-GSC-016`, `REQ-GSC-017`
- Endpoints reales montados bajo `/api`:
  - `POST /api/documents/:documentId/sign`
  - `POST /api/signature/documents/:documentId/sign`
  - `GET /api/verificar/:token`
  - `GET /api/verify/:token`
  - `GET /api/signature/verificar/:token`
  - `GET /api/signature/verify/:token`
  - `GET /api/documents/:documentId/audit-trail`
  - `GET /api/signature/documents/:documentId/audit-trail`
  - `GET /api/dashboard`
  - `GET /api/signature/dashboard`
- Proceso:
  1. valida payload de firma.
  2. calcula hash y actualiza `document_hashes`.
  3. inserta `document_signatures_advanced`.
  4. ejecuta `create_document_seal_and_qr`.
  5. bloquea el documento.
  6. expone verificacion por token y dashboard.

## 4. Validaciones funcionales relevantes
- `auth/refresh` rechaza refresh token si no corresponde a una sesion activa.
- `security` solo admite roles TI.
- `audit-prep` valida MIME y peso de archivo.
- `audit-prep` valida seccion permitida por rol.
- `signature` exige `signer_email` desde usuario autenticado y `session_id` para trazabilidad.

## 5. Flujos principales
### Flujo A - Login
1. Usuario accede a `/auth/google`.
2. Google devuelve `code`.
3. Backend crea/actualiza usuario.
4. Backend genera JWT y sesion.
5. Backend registra auditoria de login y posible evento off-hours.
6. Frontend recibe tokens y continua carga de sesion.

### Flujo B - Revision off-hours
1. TI consulta cola de eventos.
2. Backend consulta `auditoria.logs` y `notifications`.
3. TI revisa evento.
4. Backend marca notificacion como leida y registra accion de revision.

### Flujo C - Firma
1. Usuario autenticado envia documento base64.
2. Backend calcula hash.
3. Backend inserta firma avanzada.
4. Backend crea sello y QR.
5. Documento queda bloqueado.
6. El token puede verificarse por endpoints publicos.

## 6. Restricciones y limites observados
- `approvals` no segmenta la cola por aprobador real; expone un conjunto general de pendientes dentro del alcance de roles habilitados.
- `management/requests` devuelve `rowCount` del lote y no un total real global.
- `signature` depende de funciones y vistas SQL especificas (`create_document_seal_and_qr`, `track_qr_access`, `document_verification_info`).
