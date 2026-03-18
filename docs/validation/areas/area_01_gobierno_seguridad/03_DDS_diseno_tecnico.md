# DDS - AREA 01 GOBIERNO, SEGURIDAD, CUMPLIMIENTO Y GESTION DOCUMENTAL

## 1. Introduccion
El presente documento describe el diseno tecnico real del Area 01 del sistema SPI. Su objetivo no es solamente enumerar archivos, rutas y tablas, sino explicar por que cada componente tecnico existe dentro del dominio, como se relaciona con los demas modulos y cuando interviene dentro de los flujos transversales de autenticacion, seguridad, auditoria, aprobaciones, gestion documental, notificaciones, dashboards y firma.

## 2. Objetivo
Documentar la arquitectura, los componentes tecnicos, las dependencias, las integraciones y los mecanismos de control que soportan el Area 01.

## 3. Arquitectura del area
### 3.1 Capas
- Frontend React.
- API Express.
- Servicios de negocio por modulo.
- Persistencia PostgreSQL.
- Integraciones Google OAuth, Drive, Docs y Gmail.
- Jobs internos y utilitarios de soporte.

### 3.2 Ruteo y seguridad global
- `app.js` monta autenticacion publica en `/api/v1/auth`.
- `signature` conserva montaje historico en `/api` y expone alias versionado en `/api/v1/signature`.
- `documents`, `files`, `notifications`, `dashboard` y `gmail` estan montados en runtime bajo `/api/v1`.
- `verifyToken` protege todo lo no exceptuado.
- `requireRole` concentra control de acceso por modulo.
- `auditMiddleware` deja trazabilidad transversal.

## 4. Integraciones del area
| Integracion | Por que existe | Como se usa | Cuando interviene |
|---|---|---|---|
| Google OAuth | Para delegar autenticacion federada y autorizacion de Gmail | Intercambio de `code`, consulta de `userinfo` y obtencion de tokens OAuth | Durante login y autorizacion Gmail |
| Google Drive | Para custodiar evidencia documental y archivos asociados | Creacion de carpetas, carga de archivos y enlace a metadatos persistidos | Durante LOPDP, `audit-prep` y generacion documental |
| Google Docs | Para generar o modificar documentos base | Plantillas, contenido y exportacion posterior | Durante `documents` |
| Gmail API | Para enviar correo desde la cuenta autorizada del usuario | OAuth por usuario, consulta de estado, envio y revocacion | Durante flujos que exigen correo autenticado |
| Funciones SQL de firma | Para consolidar sello, QR y verificacion documental | Llamadas a funciones y vistas especializadas de base de datos | Durante firma y verificacion publica |

### 4.1 Delimitacion frente a respaldo de base de datos
El repositorio contiene un job tecnico de respaldo de base de datos hacia Google Drive, expuesto por `internalJobs.routes.js` y materializado en `databaseBackupToDrive.js`. Ese mecanismo no forma parte del dominio funcional del Area 01 y debe tratarse en un expediente separado de infraestructura o continuidad TI.

## 5. Diseno por modulo
### `auth`
Usa Google OAuth, crea o actualiza usuario, emite JWT, registra sesion y soporta perfil, refresh, logout y aceptacion documental interna.

### `security`
Lee eventos desde `auditoria.logs`, enlaza notificaciones y contexto de usuario, sanea salida y permite consulta, revision, timeline y exportacion.

### `auditoria`
Filtra, pagina y exporta registros de `auditoria.logs` para investigacion y evidencia.

### `audit-prep`
Mantiene `audit_settings`, filtra `audit_sections`, registra `audit_documents` y controla accesos externos temporales.

### `approvals`
Consulta pendientes sobre `requests`, registra decisiones en `request_approvals`, actualiza estado y dispara notificacion o correo.

### `management`
Agrega metricas desde `requests`, lista solicitudes, consulta trazabilidad en `auditoria.logs` y relaciona adjuntos y versiones.

### `documents`
`createFromTemplate` crea documentos, `signAtTag` inserta firma grafica, `signAdvanced` escala a firma avanzada, `exportPdf` genera salida PDF y los endpoints de lectura recuperan el documento por solicitud o identificador.

### `files`
Usa `multer` con almacenamiento temporal en `/tmp`, permite carga multiple, listado por solicitud, metadata, descarga y borrado controlado.

### `notifications`
Lista notificaciones y conteo no leido, crea notificaciones propias o cruzadas segun rol y permite marcar lectura, limpiar historial o eliminar una notificacion.

### `dashboard`
Expone `GET /api/v1/dashboard/comercial/summary`, usa cache opcional y clasifica errores de esquema o base de datos.

### `gmail`
Genera URL de autorizacion OAuth, procesa callback publico, persiste tokens en `user_gmail_tokens`, verifica estado de autorizacion, envia correos y revoca acceso.

### `signature`
Calcula hash, registra firma avanzada, genera sello y QR, bloquea documento y expone verificacion publica y dashboard.

## 6. Modelo tecnico de datos
### Entidades principales
- `users`
- `departments`
- `user_sessions`
- `user_lopdp_consents`
- `user_gmail_tokens`
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

## 7. API real del area
- `auth`: `/api/v1/auth/*`
- `security`: `/api/v1/security/*`
- `auditoria`: `/api/v1/auditoria/*`
- `audit-prep`: `/api/v1/audit-prep/*`
- `approvals`: `/api/v1/approvals/*`
- `management`: `/api/v1/management/*`
- `documents`: `/api/v1/documents/*`
- `files`: `/api/v1/files/*`
- `notifications`: `/api/v1/notifications/*`
- `dashboard`: `/api/v1/dashboard/comercial/summary`
- `gmail`: `/api/v1/gmail/*`
- `signature`: `/api/*` y `/api/v1/signature/*`

## 8. Frontend consumidor relevante
- `spi_front/src/modules/shared/pages/LoginCallback.jsx`
- `spi_front/src/modules/audit-prep/AuditPrepPage.jsx`
- `spi_front/src/modules/auditoria/*`
- `spi_front/src/modules/signature/pages/SignatureDashboard.jsx`
- `spi_front/src/core/ui/NotificationContext.jsx`
- `spi_front/src/core/ui/components/NotificationBell.jsx`
- `spi_front/src/core/ui/widgets/GmailAuthWidget.jsx`
- `spi_front/src/core/api/documentsApi.js`
- `spi_front/src/core/api/filesApi.js`
- `spi_front/src/core/api/notificationsApi.js`
- `spi_front/src/core/api/dashboardApi.js`

## 9. Conclusion
El diseno tecnico del Area 01 muestra un dominio transversal que articula autenticacion, seguridad, auditoria, preparacion documental, documentos formales, adjuntos, notificaciones, dashboard y correo autenticado con una base tecnica verificable en runtime.
