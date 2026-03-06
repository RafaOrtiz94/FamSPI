# MAPA DE MODULOS DEL SISTEMA - SPI FAM

## 1. Alcance del analisis
- Repositorio analizado: `backend/src`, `backend/migrations`, `backend/src/jobs`, `backend/src/routes`, `backend/src/middlewares`, `backend/src/utils`, `spi_front/src`, `ops`.
- Se excluyo `reference_backup` por corresponder a codigo historico/no activo.
- Inventario identificado: 42 modulos backend, 15 modulos frontend, mas de 140 migraciones SQL.

## 1.1 Contexto del sistema
- La plataforma corresponde a un sistema de procesos internos corporativos.
- No corresponde a un ERP contable/fiscal tradicional.
- El modulo financiero existente opera control interno (inventario financiero y viaticos), no facturacion tributaria.

## 2. Arquitectura general del sistema
- Estilo: monolito modular (Node.js + Express) con frontend SPA en React.
- Backend: modulos por dominio, rutas REST, controladores y servicios con SQL directo (sin ORM).
- Frontend: `core` + `modules` por area funcional, consumo API via `axios` con refresh token.
- Seguridad: JWT global, `helmet`, CORS por whitelist, rate limit, middlewares de rol en rutas sensibles.
- Integraciones externas: Google OAuth2, Google Drive/Docs/Gmail/Chat/Calendar, API externa Silver.
- Procesamiento asincrono:
- Jobs en `backend/src/jobs`.
- Cola de despacho de notificaciones (`notification_dispatch_queue`).
- Cola de generacion de hojas Business Case (`bc_sheet_generation_jobs`).

## 3. Modulos funcionales detectados por area

| Area | Modulo funcional | Objetivo de negocio | Backend principal | Frontend principal | Criticidad |
|---|---|---|---|---|---|
| Seguridad y acceso | Autenticacion y Sesiones | Control de acceso, identidad y sesiones activas | `modules/auth`, `middlewares/auth` | `core/auth`, `modules/shared/pages/Login*` | CRITICO |
| Gobierno de usuarios | Usuarios y Perfiles | Administrar usuarios, perfil y certificaciones | `modules/users`, `modules/user-profile`, `modules/user-certifications` | `modules/talento/pages/Usuarios`, `modules/profile` | CRITICO |
| Area Comercial | Comercial y Gestion de Clientes | Gestion de solicitudes comerciales, clientes, compras y cronogramas | `modules/requests`, `modules/clients`, `modules/equipment-purchases`, `modules/private-purchases`, `modules/schedules` | `modules/comercial`, `modules/backoffice`, `core/api/clientsApi` | CRITICO |
| Area Comercial | Business Case Comercial | Evaluacion tecnico-economica y workflow de factibilidad comercial | `modules/business-case` | `modules/comercial/pages/BusinessCaseWorkspace`, `core/api/businessCaseApi` | ALTO |
| Talento Humano | Talento Humano y Gestion de Personal | Permisos, vacaciones, asistencia, solicitudes de personal y colaboradores | `modules/talento_humano`, `modules/permisos`, `modules/vacaciones`, `modules/personnel-requests`, `modules/collaborators`, `modules/departments`, `modules/attendance` | `modules/talento`, `modules/shared/solicitudes`, `core/api/permisosApi` | ALTO |
| Servicio Tecnico | Servicio Tecnico y Mantenimientos | Planificacion tecnica, mantenimientos, aplicaciones y evidencias operativas | `modules/servicio`, `modules/mantenimientos`, `modules/technical-applications`, `modules/approvals` | `modules/servicio`, `core/api/servicioApi`, `core/api/mantenimientosApi` | ALTO |
| Operaciones y activos | Inventario y Equipos | Trazabilidad de unidades, estados, seriales y movimientos | `modules/inventario` | `core/api/inventarioApi`, vistas de servicio/operaciones | CRITICO |
| Finanzas operativas | Control Financiero Operativo y Viaticos | Control de inventario financiero, viaticos y conciliacion | `modules/finanzas`, `modules/viaticos` | `modules/finanzas`, `core/api/viaticosApi` | ALTO |
| Gestion documental | Documentos, Archivos y Firma Digital | Gestion documental, adjuntos, firma avanzada y verificacion | `modules/documents`, `modules/files`, `modules/signature` | `core/api/documentsApi`, `core/api/filesApi`, `core/api/signatureApi`, `modules/signature` | ALTO |
| Comunicaciones | Notificaciones y Comunicaciones | Notificaciones in-app, email/chat y despacho asincrono | `modules/notifications`, `jobs/processNotificationDispatchQueue` | `core/api/notificationsApi` | ALTO |
| TI y soporte | TI Soporte y Tickets | Mesa de ayuda TI con SLA, estados, comentarios y KPI operativos | `modules/support-tickets` | `modules/ti/pages/TicketsWorkspace`, `core/api/supportTicketsApi` | ALTO |
| Gobierno y supervision | Reportes y Auditoria | KPI de procesos internos, auditoria y evidencia | `modules/dashboard`, `modules/auditoria`, `modules/audit-prep` | `modules/comercial/pages/Dashboard`, `modules/gerencia`, `modules/audit-prep` | ALTO |

## 4. Mapa de dependencias entre modulos

```text
Autenticacion y Sesiones -> Todos los modulos privados
Usuarios y Perfiles -> Talento Humano, Comercial, TI Soporte, Auditoria
Comercial y Gestion de Clientes -> Inventario, Documentos/Firma, Notificaciones, Business Case
Business Case Comercial -> Comercial, Inventario, Notificaciones
Talento Humano y Gestion de Personal -> Usuarios, Documentos/Firma, Notificaciones
Servicio Tecnico y Mantenimientos -> Comercial, Inventario, Documentos/Firma, Notificaciones
Inventario y Equipos -> Comercial, Servicio Tecnico, Finanzas Operativas
Control Financiero Operativo y Viaticos -> Usuarios, Comercial, Inventario, Talento Humano
Documentos/Archivos/Firma -> Comercial, Servicio Tecnico, Talento Humano
Notificaciones y Comunicaciones -> Todos los modulos transaccionales
TI Soporte y Tickets -> Usuarios, Notificaciones
Reportes y Auditoria -> Comercial, Talento Humano, Servicio Tecnico, TI Soporte
```

## 5. Entidades de base de datos relevantes por modulo
- Comercial y Gestion de Clientes: `requests`, `request_types`, `request_versions`, `request_attachments`, `request_approvals`, `request_status_history`, `client_requests`, `client_request_consents`, `client_request_quality_checks`, `clients`, `client_assignments`, `client_visit_logs`, `prospect_visits`, `visit_schedules`, `scheduled_visits`, `equipment_purchase_requests`, `equipment_purchase_provider_contacts`, `private_purchase_requests`, `private_purchase_state_transitions`, `purchase_delivery_schedules`.
- Business Case Comercial: `bc_master`, `bc_economic_data`, `bc_operational_data`, `bc_determinations`, `bc_equipment_selection`, `bc_investments`, `bc_investment_catalog`, `bc_investment_selections`, `bc_consumption_items`, `bc_dispatch_items`, `business_case_state_transitions`, `business_case_section_ownership`, `bc_sheet_generation_jobs`.
- Talento Humano y Gestion de Personal: `employees`, `departments`, `permisos_vacaciones`, `permisos_estudios_matriculas`, `permisos_vacaciones_firmas`, `vacaciones_solicitudes`, `vacaciones_solicitudes_firmas`, `user_attendance_records`, `attendance_exceptions`, `attendance_overtime`, `personnel_requests`, `personnel_request_history`, `personnel_request_comments`, `personnel_request_profiles`, `personnel_request_documents`, `collaborator_profiles`, `collaborator_documents`.
- Servicio Tecnico y Mantenimientos: `servicio.cronograma_capacitacion`, `servicio.disponibilidad_tecnicos`, `servicio.cronograma_actividades_tecnicas`, `servicio.cronograma_mantenimientos`, `servicio.cronograma_mantenimientos_anuales`, `servicio.workflow_documents`, `servicio.aplicaciones_tecnicas`, `documents`.
- Documentos, Archivos y Firma: `documents`, `document_signatures`, `request_attachments`, `document_hashes`, `document_signatures_advanced`, `document_seals`, `document_qr_codes`, `document_signature_logs`.
- Notificaciones y Comunicaciones: `notifications`, `notification_recipients_config`, `notification_dispatch_queue`, `notification_process_email_threads`.
- TI Soporte y Tickets: `support_tickets`, `support_ticket_events`, `support_ticket_comments`.

## 6. Integraciones externas e infraestructura
- Google OAuth2: login corporativo.
- Google Drive/Docs: gestion de evidencias, plantillas y documentos de flujo.
- Google Gmail/Chat: despacho de notificaciones por canal.
- Google Calendar: agenda y coordinaciones operativas.
- API externa Silver: sincronizacion de inventario financiero.
- Infraestructura: Cloud Run (backend), Caddy reverse proxy (`ops/Caddyfile`), secretos en GCP.

## 7. Hallazgos de arquitectura para validacion
- No existe capa ORM; la integridad depende de SQL y restricciones en DB.
- Persisten operaciones `CREATE TABLE IF NOT EXISTS` en servicios runtime (riesgo de deriva de esquema).
- Existen prefijos redundantes en rutas legacy (`/api/v1/talento-humano/api/v1/hr/...` y `finanzas.routes.js`).
- Existen rutas con control de rol incompleto o disperso en algunos modulos (`users`, `departments`, partes de `private-purchases`).
- El sistema presenta coexistencia de flujos legacy y flujos nuevos en compras/BC, con riesgo de dualidad de fuente de verdad.

## 8. Matriz de prioridad de validacion

| Orden | Modulo | Criticidad | Prioridad de validacion |
|---|---|---|---|
| 1 | Autenticacion y Sesiones | CRITICO | MUY ALTA |
| 2 | Comercial y Gestion de Clientes | CRITICO | MUY ALTA |
| 3 | Inventario y Equipos | CRITICO | MUY ALTA |
| 4 | Usuarios y Perfiles | CRITICO | MUY ALTA |
| 5 | Business Case Comercial | ALTO | ALTA |
| 6 | Talento Humano y Gestion de Personal | ALTO | ALTA |
| 7 | Servicio Tecnico y Mantenimientos | ALTO | ALTA |
| 8 | Control Financiero Operativo y Viaticos | ALTO | ALTA |
| 9 | Documentos, Archivos y Firma Digital | ALTO | MEDIA-ALTA |
| 10 | Notificaciones y Comunicaciones | ALTO | MEDIA-ALTA |
| 11 | TI Soporte y Tickets | ALTO | MEDIA-ALTA |
| 12 | Reportes y Auditoria | ALTO | MEDIA |
