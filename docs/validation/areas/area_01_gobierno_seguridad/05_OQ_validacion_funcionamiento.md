# OQ - AREA 01 GOBIERNO, SEGURIDAD, CUMPLIMIENTO Y GESTION DOCUMENTAL

## 1. Introduccion
La calificacion operacional del Area 01 se orienta a demostrar que los modulos incluidos en su alcance ejecutan las funciones esperadas de manera coherente con la especificacion funcional vigente. El foco principal es validar autenticacion, seguridad, auditoria, preparacion documental, aprobaciones, gestion gerencial, documentos, archivos, notificaciones, dashboard, Gmail y firma documental bajo condiciones normales y de error controlado.

## 2. Casos OQ por modulo
### `auth`
- `GET /api/v1/auth/google`: redirige a Google OAuth.
- `GET /api/v1/auth/google/callback?code=*`: crea o actualiza usuario, crea sesion y registra auditoria.
- `GET /api/v1/auth/me`: devuelve perfil autenticado.
- `POST /api/v1/auth/refresh`: renueva tokens solo si el refresh token corresponde a una sesion activa.
- `POST /api/v1/auth/lopdp/accept`: guarda evidencia interna en Drive y actualiza `users` y `user_lopdp_consents`.

### `security`
- `GET /api/v1/security/offhours-logins`: devuelve eventos off-hours saneados y paginados.
- `GET /api/v1/security/offhours-logins/:id/timeline`: devuelve timeline asociado al `correlation_id`.
- `POST /api/v1/security/offhours-logins/:id/review`: marca notificaciones de seguridad como revisadas.
- `GET /api/v1/security/offhours-logins/export`: exporta CSV o JSON saneado.

### `auditoria`
- `GET /api/v1/auditoria`, `GET /api/v1/auditoria/:id`, `GET /api/v1/auditoria/export/csv` deben listar, detallar y exportar la bitacora.

### `audit-prep`
- `GET /api/v1/audit-prep/status` devuelve estado y ventana.
- `PUT /api/v1/audit-prep/status` actualiza modo y fechas.
- `GET /api/v1/audit-prep/sections` filtra secciones por rol.
- `POST /api/v1/audit-prep/documents/upload` valida archivo, crea carpeta Drive y registra `audit_documents`.
- `GET /api/v1/audit-prep/documents/:id/download` entrega documento si la seccion esta permitida.

### `approvals`
- `GET /api/v1/approvals/pending` lista pendientes del flujo soportado.
- `POST /api/v1/approvals/:id/approve` y `POST /api/v1/approvals/:id/reject` registran decision y actualizan `requests.status`.

### `management`
- `GET /api/v1/management/stats`, `GET /api/v1/management/requests`, `GET /api/v1/management/trace/:id`, `GET /api/v1/management/documents/:id` deben devolver metricas, solicitudes, trazabilidad y soporte documental.

### `documents`
- `POST /api/v1/documents/from-template` crea documento desde plantilla.
- `GET /api/v1/documents/by-request/:requestId` lista documentos por solicitud.
- `POST /api/v1/documents/:documentId/sign` inserta firma posicionada.
- `POST /api/v1/documents/:documentId/export-pdf` exporta PDF.

### `files`
- `POST /api/v1/files/upload/:requestId` carga adjuntos.
- `GET /api/v1/files/by-request/:requestId` lista adjuntos.
- `GET /api/v1/files/:fileId/download` descarga archivo.
- `DELETE /api/v1/files/:fileId` elimina archivo solo si el rol esta autorizado.

### `notifications`
- `GET /api/v1/notifications` devuelve notificaciones del usuario y conteo no leido.
- `POST /api/v1/notifications` crea notificacion; si apunta a otro usuario exige rol privilegiado.
- `PATCH /api/v1/notifications/:id/read`, `PATCH /api/v1/notifications/read-all`, `DELETE /api/v1/notifications/clear` gestionan la bandeja.

### `dashboard`
- `GET /api/v1/dashboard/comercial/summary` devuelve resumen operacional comercial para rol autorizado.
- `GET /api/v1/dashboard/comercial/summary?fresh=1` invalida cache y devuelve resumen fresco.

### `gmail`
- `GET /api/v1/gmail/auth/url` devuelve URL de autorizacion Gmail.
- `GET /api/v1/gmail/auth/callback?code=*` guarda tokens del usuario y devuelve pagina de autorizacion exitosa.
- `GET /api/v1/gmail/auth/status` informa si el usuario tiene Gmail autorizado.
- `POST /api/v1/gmail/send` envia email usando la cuenta autorizada del usuario.
- `DELETE /api/v1/gmail/auth/revoke` revoca el acceso y elimina los tokens.

### `signature`
- `POST /api/v1/signature/documents/:documentId/sign` calcula hash, inserta firma, crea sello y QR y bloquea documento.
- `GET /api/v1/signature/verificar/:token` devuelve verificacion publica si el token existe y esta activo.
- `GET /api/v1/signature/documents/:documentId/audit-trail` devuelve trail documental.
- `GET /api/v1/signature/dashboard` devuelve metricas del modulo.

## 3. Escenarios de error a registrar
- `401` token ausente o invalido
- `403` acceso por rol no autorizado
- `404` id o token inexistente
- `409` conflicto de negocio en `audit-prep` o `documents`
- `500` error SQL, integracion Drive, Docs, Gmail o funcion SQL de firma
- `503` indisponibilidad de dashboard por error de base clasificado

## 4. Conclusiones de OQ
La OQ del Area 01 debe demostrar no solo que autenticacion, seguridad, auditoria y firma operan, sino tambien que la gestion documental, los adjuntos, las notificaciones, el dashboard y Gmail responden de forma coherente, trazable y controlada.
