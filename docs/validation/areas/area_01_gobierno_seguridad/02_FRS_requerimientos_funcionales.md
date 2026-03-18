# FRS - AREA 01 GOBIERNO, SEGURIDAD, CUMPLIMIENTO Y GESTION DOCUMENTAL

## 1. Introduccion
La presente especificacion funcional describe el comportamiento verificable del Area 01 del sistema SPI. Su objetivo es traducir los requerimientos de usuario del dominio a funciones concretas observables en el sistema, explicando para cada modulo por que existe la funcion, como debe ejecutarse y cuando debe intervenir dentro de la operacion real. Esta FRS se elaboro a partir del codigo vigente y de los contratos efectivamente expuestos por backend y frontend.

## 2. Objetivo
Definir de manera funcional y verificable las capacidades del Area 01, detallando el comportamiento esperado de `auth`, `security`, `auditoria`, `audit-prep`, `approvals`, `management`, `signature`, `documents`, `files`, `notifications`, `dashboard` y `gmail`, junto con sus entradas, salidas, validaciones y contexto de ejecucion.

## 3. Alcance funcional
El alcance de esta FRS comprende autenticacion federada, control de sesion, monitoreo off-hours, consulta y exportacion de auditoria, preparacion documental, aprobaciones del flujo tecnico soportado, visibilidad gerencial, gestion documental desde plantilla, custodia de adjuntos, notificaciones operativas, dashboard comercial montado y autorizacion/envio mediante Gmail.

## 4. Requerimientos funcionales detallados
### FR-GD-001 Autenticacion federada
- Endpoints: `GET /api/v1/auth/google`, `GET /api/v1/auth/google/callback`.
- Proceso: intercambio de `code`, resolucion de `userinfo`, creacion o actualizacion de usuario, generacion de JWT, registro de sesion, auditoria y redireccion al frontend.
- Cuando aplica: cada vez que un usuario inicia sesion mediante el flujo corporativo.

### FR-GD-002 Perfil, refresh y logout
- Endpoints: `GET /api/v1/auth/me`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`.
- `me` devuelve identidad y contexto; `refresh` valida que el refresh token corresponda a una sesion activa; `logout` cierra la sesion o sesiones activas asociadas.

### FR-GD-003 Aceptacion interna LOPDP
- Endpoint: `POST /api/v1/auth/lopdp/accept`.
- Valida aceptacion y archivos, crea carpeta y evidencia en Drive, actualiza `users` e inserta fila en `user_lopdp_consents`.

### FR-GD-004 Monitoreo de seguridad off-hours
- Endpoints: `GET /api/v1/security/offhours-logins`, `GET /api/v1/security/offhours-logins/:id/timeline`, `POST /api/v1/security/offhours-logins/:id/review`, `GET /api/v1/security/offhours-logins/export`.
- Lee `auditoria.logs`, correlaciona `notifications`, `users` y `departments` y permite exportacion saneada.

### FR-GD-005 Consulta de auditoria
- Endpoints: `GET /api/v1/auditoria`, `GET /api/v1/auditoria/:id`, `GET /api/v1/auditoria/export/csv`.
- Filtra, pagina, detalla y exporta bitacora transversal.

### FR-GD-006 Preparacion de auditoria
- Endpoints: `GET/PUT /api/v1/audit-prep/status`, `GET/POST /api/v1/audit-prep/sections`, `GET/POST/PATCH /api/v1/audit-prep/documents*`, `GET/POST/DELETE /api/v1/audit-prep/external-access*`.
- Mantiene settings, filtra secciones, registra `audit_documents`, crea carpetas Drive y limita accesos externos activos a dos.

### FR-GD-007 Aprobaciones operativas soportadas
- Endpoints: `GET /api/v1/approvals/pending`, `POST /api/v1/approvals/:id/approve`, `POST /api/v1/approvals/:id/reject`.
- Lista pendientes, actualiza `requests.status`, registra decision en `request_approvals` y dispara correo.

### FR-GD-008 Gestion gerencial
- Endpoints: `GET /api/v1/management/stats`, `GET /api/v1/management/requests`, `GET /api/v1/management/trace/:id`, `GET /api/v1/management/documents/:id`.
- Entrega metricas, solicitudes, trazabilidad y soporte documental del dominio.

### FR-GD-009 Gestion documental desde plantilla
- Endpoints: `POST /api/v1/documents/from-template`, `GET /api/v1/documents/by-request/:requestId`, `GET /api/v1/documents/:documentId`, `POST /api/v1/documents/:documentId/sign`, `POST /api/v1/documents/:documentId/sign-advanced`, `POST /api/v1/documents/:documentId/export-pdf`.
- Crea documentos desde plantilla, permite firma posicionada o avanzada y exporta PDF.

### FR-GD-010 Gestion de adjuntos
- Endpoints: `POST /api/v1/files/upload/:requestId`, `GET /api/v1/files/by-request/:requestId`, `GET /api/v1/files/:fileId/metadata`, `GET /api/v1/files/:fileId/download`, `DELETE /api/v1/files/:fileId`.
- Custodia anexos con carga multiple, metadata, descarga y borrado controlado.

### FR-GD-011 Notificaciones operativas
- Endpoints: `GET /api/v1/notifications`, `POST /api/v1/notifications`, `PATCH /api/v1/notifications/read-all`, `PATCH /api/v1/notifications/:id/read`, `DELETE /api/v1/notifications/clear`, `DELETE /api/v1/notifications/:id`.
- Lista la bandeja del usuario, crea notificaciones y controla lectura o eliminacion.

### FR-GD-012 Dashboard operacional montado
- Endpoint: `GET /api/v1/dashboard/comercial/summary`.
- Exige autenticacion, rol permitido y permite `fresh=1` para refresco de cache.

### FR-GD-013 Autorizacion y envio mediante Gmail
- Endpoints: `GET /api/v1/gmail/auth/url`, `GET /api/v1/gmail/auth/callback`, `GET /api/v1/gmail/auth/status`, `POST /api/v1/gmail/send`, `DELETE /api/v1/gmail/auth/revoke`.
- Genera URL de autorizacion, guarda tokens en `user_gmail_tokens`, informa estado, envia correo y revoca acceso.

### FR-GD-014 Firma avanzada y verificacion publica
- Endpoints: `POST /api/v1/signature/documents/:documentId/sign`, `GET /api/v1/signature/verificar/:token`, `GET /api/v1/signature/documents/:documentId/audit-trail`, `GET /api/v1/signature/dashboard`.
- Calcula hash, registra firma avanzada, genera sello y QR, bloquea documento, verifica y expone metricas.

## 5. Flujos principales
### Flujo A - Login corporativo
```text
[Usuario inicia login] -> [Google OAuth] -> [Callback backend]
-> [Crear/actualizar usuario] -> [Crear sesion y tokens]
-> [Auditoria y off-hours] -> [Frontend con sesion operativa]
```

### Flujo B - Revision off-hours
```text
[Login fuera de horario] -> [auditoria.logs]
-> [Relacion con notifications] -> [Consulta TI]
-> [Timeline y detalle] -> [Revision y cierre]
```

### Flujo C - Preparacion y custodia documental de auditoria
```text
[Activar auditoria] -> [Definir secciones] -> [Cargar documento]
-> [Persistir audit_documents + Drive] -> [Descarga por rol]
-> [Alta/revocacion de acceso externo]
```

### Flujo D - Gestion documental y firma
```text
[Crear desde plantilla] -> [Recuperar documento]
-> [Firma posicionada o avanzada] -> [Exportar PDF]
-> [Sello, QR y bloqueo] -> [Verificacion publica]
```

### Flujo E - Notificacion y correo autenticado
```text
[Evento operativo] -> [Crear notificacion]
-> [Usuario lista/lee/limpia]
-> [Si requiere correo] -> [OAuth Gmail]
-> [Enviar email] -> [Auditoria del envio]
```

## 6. Conclusion
La FRS del Area 01 deja descrito el comportamiento funcional real del dominio ampliado. El area incorpora gestion documental, notificaciones, adjuntos, dashboard operacional y Gmail donde existe evidencia tecnica de montaje y consumo.
