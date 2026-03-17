# DDS - AREA 01 GOBIERNO, SEGURIDAD Y CUMPLIMIENTO

## 1. Introduccion
Este DDS describe el diseno tecnico real del area 01 segun el codigo vigente del repositorio SPI.

## 2. Arquitectura del area
### 2.1 Capas
- Frontend React.
- API Express.
- Servicios de negocio por modulo.
- Persistencia PostgreSQL.
- Integraciones Google OAuth, Drive, Docs y correo.
- Jobs internos para procesos programados.

### 2.2 Ruteo y seguridad global
- `app.js` monta autenticacion publica en `/api/v1/auth`.
- `signature` conserva montaje historico en `/api` y expone alias versionado en `/api/v1/signature`.
- El middleware global `verifyToken` protege todo lo no exceptuado.
- El control de roles real se centraliza en `middlewares/roles.js`.
- `auditMiddleware` corre despues de autenticacion y normalizacion.

### 2.3 Integraciones
- Google OAuth para login.
- Google Drive para LOPDP interna y `audit-prep`.
- Correo para notificaciones de aprobacion/rechazo.
- Funciones SQL para sello/QR y tracking de verificacion documental.
- Credenciales Google resueltas por secretos o variables de entorno; se elimino la dependencia funcional a un archivo versionado de service account.

## 3. Modulos del area
### 3.1 `auth`
**Archivos**
- `backend/src/modules/auth/auth.routes.js`
- `backend/src/modules/auth/auth.controller.js`
- `backend/src/modules/auth/session.repository.js`
- `spi_front/src/core/api/authApi.js`
- `spi_front/src/core/auth/AuthContext.jsx`
- `spi_front/src/modules/shared/pages/LoginCallback.jsx`

**Responsabilidad**
- login Google OAuth
- emision de JWT
- refresh/logout
- consulta de perfil
- aceptacion LOPDP interna
- auditoria de login y deteccion off-hours
- sincronizacion de clock-in diario durante callback de login

**Dependencias**
- `users`, `departments`, `user_sessions`, `user_profile`, `user_lopdp_consents`
- `utils/audit`, `notifications`, Google OAuth, Drive

### 3.2 `security`
**Archivos**
- `backend/src/modules/security/security.routes.js`
- `backend/src/modules/security/security.controller.js`
- `backend/src/modules/security/security.privacy.js`
- `backend/src/modules/security/security.whitelist.js`
- `backend/src/modules/security/security.siem.js`

**Responsabilidad**
- consultar logins fuera de horario
- revisar eventos
- exportar eventos
- sanear IP y user-agent al exponer datos

**Dependencias**
- `auditoria.logs`, `notifications`, `users`, `departments`

**Nota de diseno**
- `security.whitelist.js` y `security.siem.js` existen como servicios auxiliares, pero no forman parte del flujo core montado por rutas del centro de seguridad.

### 3.3 `auditoria`
**Archivos**
- `backend/src/modules/auditoria/audit.routes.js`
- `backend/src/modules/auditoria/audit.controller.js`
- `backend/src/modules/auditoria/auditoria.service.js`
- `spi_front/src/core/api/auditoriaApi.js`
- `spi_front/src/modules/gerencia/Auditoria.jsx`

**Responsabilidad**
- filtrar, paginar, detallar y exportar la bitacora transversal.

### 3.4 `audit-prep`
**Archivos**
- `backend/src/modules/audit-prep/auditPrep.routes.js`
- `backend/src/modules/audit-prep/auditPrep.controller.js`
- `backend/src/modules/audit-prep/auditPrep.service.js`
- `spi_front/src/core/api/auditPrepApi.js`
- `spi_front/src/modules/audit-prep/AuditPrepPage.jsx`

**Responsabilidad**
- gestionar configuracion de auditoria
- administrar secciones y documentos
- otorgar/revocar accesos externos

**Dependencias**
- `audit_settings`, `audit_sections`, `audit_documents`, `audit_access_grants`
- `utils/drive`

### 3.5 `approvals`
**Archivos**
- `backend/src/modules/approvals/approvals.routes.js`
- `backend/src/modules/approvals/approvals.controller.js`
- `backend/src/modules/approvals/approvals.service.js`
- `spi_front/src/core/api/approvalsApi.js`
- `spi_front/src/modules/servicio/pages/Aprobaciones.jsx`
- `spi_front/src/modules/servicio/components/PendingApprovals.jsx`

**Responsabilidad**
- listar pendientes
- aprobar o rechazar solicitudes del flujo tecnico/servicio
- registrar decision en `request_approvals`
- enviar correo

### 3.6 `management`
**Archivos**
- `backend/src/modules/management/management.routes.js`
- `backend/src/modules/management/management.controller.js`
- `backend/src/modules/management/management.service.js`

**Responsabilidad**
- exponer dashboard gerencial
- listar solicitudes
- consultar trazabilidad y documentos por solicitud

**Dependencias**
- `requests`, `request_types`, `users`, `auditoria.logs`, `request_attachments`, `request_versions`

### 3.7 `signature`
**Archivos**
- `backend/src/modules/signature/signature.routes.js`
- `backend/src/modules/signature/signature.controller.js`
- `backend/src/services/signatures/*`
- `spi_front/src/core/api/signatureApi.js`
- `spi_front/src/modules/signature/components/DocumentSigner.jsx`
- `spi_front/src/modules/signature/pages/DocumentVerification.jsx`
- `spi_front/src/modules/signature/pages/SignatureDashboard.jsx`

**Responsabilidad**
- calcular hash
- registrar firma avanzada
- emitir sello y QR
- bloquear documento
- verificar token publico
- exponer audit trail y dashboard

**Dependencias**
- `documents`, `document_hashes`, `document_signatures_advanced`, `document_seals`, `document_qr_codes`, `document_signature_logs`, `document_verification_info`
- funciones SQL `create_document_seal_and_qr`, `track_qr_access`

## 4. Modelo tecnico de datos
### Entidades principales
- `users`
- `departments`
- `user_sessions`
- `user_lopdp_consents`
- `auditoria.logs`
- `notifications`
- `requests`
- `request_types`
- `request_approvals`
- `request_attachments`
- `request_versions`
- `audit_settings`
- `audit_sections`
- `audit_documents`
- `audit_access_grants`
- `documents`
- `document_hashes`
- `document_signatures_advanced`
- `document_seals`
- `document_qr_codes`
- `document_signature_logs`
- `document_verification_info`

### Relaciones relevantes
- `users.department_id -> departments.id`
- `request_approvals.request_id -> requests.id`
- `request_approvals.approver_id -> users.id`
- `audit_documents.section_code -> audit_sections.code`
- `documents.current_hash_id -> document_hashes.id`
- `document_signatures_advanced.document_id -> documents.id`
- `document_signatures_advanced.document_hash_id -> document_hashes.id`
- `document_seals.document_id -> documents.id`
- `document_qr_codes.seal_id -> document_seals.id`
- `document_signature_logs.document_id -> documents.id`

## 5. API real del area
### `auth`
- `GET /api/v1/auth/google`
- `GET /api/v1/auth/google/callback`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/lopdp/accept`
- `GET /api/v1/auth/sessions`
- `GET /api/v1/auth/active-users`

### `security`
- `GET /api/v1/security/offhours-logins`
- `GET /api/v1/security/offhours-logins/:id/timeline`
- `POST /api/v1/security/offhours-logins/:id/review`
- `GET /api/v1/security/offhours-logins/export`

### `auditoria`
- `GET /api/v1/auditoria`
- `GET /api/v1/auditoria/:id`
- `GET /api/v1/auditoria/export/csv`

### `audit-prep`
- `GET /api/v1/audit-prep/status`
- `PUT /api/v1/audit-prep/status`
- `GET /api/v1/audit-prep/sections`
- `POST /api/v1/audit-prep/sections`
- `GET /api/v1/audit-prep/documents`
- `POST /api/v1/audit-prep/documents/upload`
- `PATCH /api/v1/audit-prep/documents/:id/status`
- `GET /api/v1/audit-prep/documents/:id/download`
- `GET /api/v1/audit-prep/external-access`
- `POST /api/v1/audit-prep/external-access`
- `DELETE /api/v1/audit-prep/external-access/:id`

### `approvals`
- `GET /api/v1/approvals/pending`
- `POST /api/v1/approvals/:id/approve`
- `POST /api/v1/approvals/:id/reject`

### `management`
- `GET /api/v1/management/stats`
- `GET /api/v1/management/requests`
- `GET /api/v1/management/trace/:id`
- `GET /api/v1/management/documents/:id`

### `signature`
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

## 6. Flujos tecnicos
### Login
`Usuario -> /auth/google -> Google -> /auth/google/callback -> users/user_sessions -> auditoria.logs -> frontend`

### Seguridad off-hours
`auth.googleCallback -> auditoria.logs(offhours_login) -> notifications -> security.controller`

### Preparacion de auditoria
`frontend audit-prep -> auditPrep.service -> audit_settings/audit_sections/audit_documents -> Drive`

### Firma
`frontend signature -> signature.controller -> document_hashes -> document_signatures_advanced -> create_document_seal_and_qr -> documents locked -> verify token`

## 7. Seguridad y control
- `verifyToken` valida JWT y claims `iss`, `aud`, `sub`.
- `requireRole` usa grupos y alias en `middlewares/roles.js`.
- `security` restringe acceso a TI.
- `management` restringe acceso a gerencia general o admin.
- `signature` protege firma, audit trail y dashboard; la verificacion publica queda exceptuada en `app.js`.

## 8. Manejo de errores
- `401` token ausente o invalido.
- `403` rol no autorizado.
- `404` objeto o token no encontrado.
- `409` conflicto de negocio en `audit-prep`.
- `500` error de integracion, SQL o fallo interno.

## 9. Hallazgos de diseno vigentes
- `auth` tiene un acoplamiento transversal con `attendance` durante el callback de login.
- `approvals` no implementa segmentacion real por aprobador dentro de la cola pendiente.
- `management.listRequests` no devuelve un total global confiable.
- `signature` depende de funciones/vistas SQL especificas sin fallback en codigo.

## 10. Diagrama de arquitectura
```mermaid
flowchart LR
  UI[Frontend React] --> AUTH[/api/v1/auth]
  UI --> SEC[/api/v1/security]
  UI --> AUD[/api/v1/auditoria]
  UI --> APREP[/api/v1/audit-prep]
  UI --> APP[/api/v1/approvals]
  UI --> MGMT[/api/v1/management]
  UI --> SIGN[/api/* firma]

  AUTH --> USERS[(users)]
  AUTH --> SESS[(user_sessions)]
  AUTH --> LOGS[(auditoria.logs)]
  AUTH --> GOOGLE[Google OAuth / Drive]

  SEC --> LOGS
  SEC --> NOTI[(notifications)]

  AUD --> LOGS

  APREP --> ASET[(audit_settings)]
  APREP --> ASEC[(audit_sections)]
  APREP --> ADOC[(audit_documents)]
  APREP --> AACC[(audit_access_grants)]
  APREP --> DRIVE[Google Drive]

  APP --> REQ[(requests)]
  APP --> RAPP[(request_approvals)]
  APP --> MAIL[Mailer]

  MGMT --> REQ
  MGMT --> LOGS
  MGMT --> RATT[(request_attachments)]
  MGMT --> RVER[(request_versions)]

  SIGN --> DOC[(documents)]
  SIGN --> DH[(document_hashes)]
  SIGN --> DSA[(document_signatures_advanced)]
  SIGN --> DSE[(document_seals)]
  SIGN --> DQR[(document_qr_codes)]
  SIGN --> DSL[(document_signature_logs)]
```
