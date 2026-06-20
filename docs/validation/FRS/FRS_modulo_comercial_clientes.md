# FRS — MÓDULO COMERCIAL Y CLIENTES

**Sistema:** FamSPI
**Versión:** 2.0
**Fecha:** 2026-06-18
**Estado:** En revisión
**Alineación:** WHO TRS 1019, Annex 3, Appendix 5

---

## 1. Introducción

El presente documento especifica el comportamiento funcional del módulo Comercial y Clientes, describiendo cada endpoint con sus entradas reales, su lógica de proceso observable en el código y su salida esperada. La fuente de verdad son los archivos `clients.routes.js`, `clients.service.js`, `clients.controller.js`, `requests.routes.js` y `opportunities.routes.js` / `opportunities.service.js`.

---

## 2. Descripción funcional

El módulo agrupa tres sub-dominios técnicos que comparten la base de datos PostgreSQL y los middlewares transversales de autenticación y roles:

- **Sub-dominio Requests:** gestión de solicitudes comerciales generales y el flujo de alta de nuevos clientes con consentimiento LOPDP, documentos adjuntos y revisión de calidad.
- **Sub-dominio Clients:** gestión de la cartera de clientes aprobados, incluyendo asignaciones, visitas georreferenciadas, interacciones CRM y sedes con geocodificación.
- **Sub-dominio Opportunities:** gestión del pipeline comercial con cuentas (`accounts`), contactos, oportunidades y sus elementos relacionados (influencias, flags, competidores, acciones, comentarios, vínculos a procesos).

---

## 3. Especificaciones funcionales

### FRS-COM-001 — Creación de solicitud comercial general

**Endpoint:** `POST /api/v1/requests`
**Acceso:** `verifyToken` + `requireRole(["jefe_comercial", "comercial", "backoffice_comercial"])`

**Entradas:**
- Body multipart con campos del formulario de solicitud.
- Archivos opcionales: `files` (hasta 10) y `files[]` (hasta 10), procesados por `multer.memoryStorage()`.

**Proceso:**
El controlador `ctrl.createRequest` recibe el payload y los archivos procesados en memoria. El service persiste la solicitud en la tabla `requests` con referencia al usuario creador (`created_by`), su tipo (`request_type_id`) y estado inicial. Los archivos adjuntos se suben a Google Drive y sus IDs se registran en `request_attachments`.

**Salida:** `{ ok: true, data: { id, status, created_at, ... } }` — HTTP 201.

---

### FRS-COM-002 — Listado y detalle de solicitudes

**Endpoints:**
- `GET /api/v1/requests` — listado
- `GET /api/v1/requests/:id` — detalle

**Acceso:** `verifyToken` + `requireRole` con 14 roles: `gerencia`, `comercial`, `acp_comercial`, `backoffice_comercial`, `tecnico`, `finanzas`, `calidad`, `jefe_calidad`, `jefe_servicio_tecnico`, `jefe_tecnico`, `operaciones`, `jefe_operaciones`, `ti`, `jefe_ti`, `talento_humano`, `jefe_talento_humano`.

**Entradas:** Query params opcionales para filtrado; `id` de ruta para el detalle.

**Proceso:**
`ctrl.listRequests` consulta `requests` con filtros según el rol del usuario autenticado. `ctrl.getDetail` recupera la solicitud por ID y devuelve el documento completo incluyendo adjuntos y estado. Ambos verifican que el usuario tenga acceso antes de retornar datos.

**Salida:** Listado: `{ ok: true, data: [...] }`. Detalle: `{ ok: true, data: { ...solicitud, adjuntos: [...] } }`.

---

### FRS-COM-003 — Reenvío y cancelación de solicitudes

**Endpoints:**
- `PUT /api/v1/requests/:id/resubmit`
- `POST /api/v1/requests/:id/cancel`

**Acceso:** `verifyToken` + `requireRole(["jefe_comercial"])` en ambas operaciones.

**Entradas:** `id` de ruta. El reenvío puede incluir campos de corrección en el body.

**Proceso:**
`ctrl.resubmit` verifica que la solicitud esté en estado `rejected` antes de transicionarla a `pending`. `ctrl.cancel` verifica que la solicitud sea cancelable (no en estado terminal) y la marca como `cancelled`. Ambas operaciones quedan registradas en `request_status_history`.

**Salida:** `{ ok: true, data: { id, status: 'pending' | 'cancelled', ... } }`.

---

### FRS-COM-004 — Envío y verificación de token de consentimiento LOPDP

**Endpoints:**
- `POST /api/v1/requests/new-client/consent-token` — envío del token
- `POST /api/v1/requests/new-client/consent-token/verify` — verificación del token
- `GET /api/v1/requests/public/consent/:token` — otorgamiento (ruta pública sin `requireRole`)

**Acceso:** `verifyToken` para envío y verificación. Sin autenticación para el endpoint público de otorgamiento.

**Entradas:**
- Envío: `{ email, client_name }` — correo del responsable del cliente y nombre del prospecto.
- Verificación: `{ token }` — código recibido por correo.
- Otorgamiento: `token` en ruta URL (accedido desde el enlace enviado por correo).

**Proceso:**
`ctrl.sendConsentEmailToken` genera un token mediante `crypto`, lo almacena en `client_request_consent_tokens` con fecha de expiración y envía el correo con el enlace público. `ctrl.verifyConsentEmailToken` valida el token contra la base de datos y marca el consentimiento como verificado. `ctrl.grantConsent` es el handler del enlace público que registra la aceptación con timestamp e IP en `client_request_consents`.

**Salida:** Envío: `{ ok: true, message: 'Token enviado' }`. Verificación: `{ ok: true, verified: true }`. Otorgamiento: respuesta HTML de confirmación al cliente externo.

---

### FRS-COM-005 — Creación y corrección de solicitud de nuevo cliente

**Endpoints:**
- `POST /api/v1/requests/new-client` — creación
- `PUT /api/v1/requests/new-client/:id` — corrección

**Acceso:** `verifyToken` (sin `requireRole` adicional — cualquier usuario autenticado).

**Entradas:**
Body multipart con datos del cliente prospecto. Archivos opcionales procesados por `multer`:
- `legal_rep_appointment_file` — nombramiento del representante legal
- `ruc_file` — RUC en PDF
- `id_file` — documento de identificación
- `bpadt_certification_file` — certificación BPADT
- `operating_permit_file` — permiso de funcionamiento
- `consent_evidence_file` — evidencia del consentimiento LOPDP

**Proceso:**
`ctrl.createClientRequest` valida que exista un consentimiento verificado para el correo del cliente antes de crear el registro en `client_requests`. Los archivos se suben a Google Drive mediante `uploadBase64File` y sus IDs quedan en los campos `*_file_id` de la tabla. `ctrl.updateClientRequest` permite corregir campos y reemplazar archivos en solicitudes que no hayan sido aprobadas.

**Salida:** Creación: `{ ok: true, data: { id, status: 'pending', ... } }` — HTTP 201. Corrección: `{ ok: true, data: { ...solicitud actualizada } }`.

---

### FRS-COM-006 — Listado, resumen y detalle de solicitudes de nuevo cliente

**Endpoints:**
- `GET /api/v1/requests/new-client/my` — solicitudes propias (cualquier usuario autenticado)
- `GET /api/v1/requests/new-client` — todas las solicitudes (roles autorizados)
- `GET /api/v1/requests/new-client/summary` — resumen estadístico (roles autorizados)
- `GET /api/v1/requests/new-client/:id` — detalle individual (roles autorizados)

**Acceso:** `verifyToken`. Para listado global, resumen y detalle: `requireRole(["backoffice_comercial", "gerencia", "calidad", "jefe_calidad", "comercial", "jefe_comercial", "acp_comercial", "ti", "jefe_ti"])`.

**Entradas:** Query params opcionales de filtrado para listado. `id` de ruta para detalle.

**Proceso:**
`ctrl.listClientRequests` consulta `client_requests` filtrando por `created_by = req.user.email` cuando se accede por `/my`, o sin ese filtro cuando el rol tiene acceso global. `ctrl.getClientRequestSummary` devuelve conteos por estado. `ctrl.getClientRequestById` incluye los adjuntos construyendo los enlaces de Drive mediante `getClientRequestAttachments()`.

**Salida:**
- Listado propio/global: `{ ok: true, data: [...] }`.
- Resumen: `{ ok: true, data: { total, pending, approved, rejected, ... } }`.
- Detalle: `{ ok: true, data: { ...solicitud, attachments: [{ key, label, link }] } }`.

---

### FRS-COM-007 — Checklist de calidad y procesamiento de solicitud de nuevo cliente

**Endpoints:**
- `PUT /api/v1/requests/new-client/:id/quality-checklist` — actualización de checklist
- `PUT /api/v1/requests/new-client/:id/process` — procesamiento (aprobar / rechazar)

**Acceso:**
- Checklist: `verifyToken` + `requireRole(["calidad", "jefe_calidad"])`.
- Procesar: `verifyToken` + `requireRole(["backoffice_comercial"])`.

**Entradas:**
- Checklist: `{ items: [...] }` — lista de ítems del checklist con estado de revisión.
- Procesar: `{ action: 'approve' | 'reject', notes }` — decisión y justificación.

**Proceso:**
`ctrl.updateClientRequestQualityChecklist` persiste los ítems en `client_request_quality_checks`. `ctrl.processClientRequest` valida que la solicitud esté en estado procesable, registra la decisión en `client_requests`, actualiza el estado a `approved` o `rejected` y, si se aprueba, puede activar la creación del registro de cliente en la tabla correspondiente.

**Salida:** `{ ok: true, data: { id, status: 'approved' | 'rejected', ... } }`.

---

### FRS-COM-008 — Listado de clientes accesibles

**Endpoint:** `GET /api/v1/clients`
**Acceso:** `verifyToken` (visibilidad diferenciada por rol en la capa de servicio).

**Entradas (query params):**
- `q` — texto libre para búsqueda por nombre o RUC.
- `date` — fecha de visita para filtrar por cronograma.
- `include_schedule_info=true` — incluir metadatos de cronograma.
- `filter_by_schedule=true` — filtrar solo clientes del cronograma activo.
- `include_all_for_business_case=true` — incluir todos los clientes para vinculación a Business Case.

**Proceso:**
`clientsService.listAccessibleClients()` aplica lógica de visibilidad según el rol del usuario:
- Roles en `FULL_ACCESS_ROLES` ven todos los clientes activos.
- Roles en `FIELD_CLIENT_READ_ROLES` (`tecnico`, `jefe_tecnico`, `logistica`, `jefe_logistica`, `servicio_tecnico`, `jefe_servicio_tecnico`) ven solo clientes de su cartera asignada.
- Roles asesores (`comercial`, `acp_comercial`, etc.) ven solo los clientes que tienen asignados mediante asignación activa.
Si `includeScheduleInfo` está activo, se consulta `schedulesService` para agregar métricas de visita.

**Salida:** `{ ok: true, data: [...clients], prospects: [...], summary: { total, visited, pending } }`.

---

### FRS-COM-009 — Detalle de cliente

**Endpoint:** `GET /api/v1/clients/:id`
**Acceso:** `verifyToken` (sin `requireRole` explícito en ruta; la visibilidad se controla en `clientsService.getClientDetail()`).

**Entradas:** `id` numérico del cliente en la ruta.

**Proceso:**
`clientsService.getClientDetail()` recupera el registro de `client_requests` con estado `approved`, sus asignaciones activas, documentos adjuntos con sus enlaces de Drive construidos por `getClientRequestAttachments()`, y las sedes registradas. Verifica que el usuario tenga acceso al cliente antes de retornar.

**Salida:** `{ ok: true, data: { ...cliente, assignments: [...], attachments: [...], locations: [...] } }`.

---

### FRS-COM-010 — Actualización de datos del cliente

**Endpoint:** `PUT /api/v1/clients/:id`
**Acceso:** `verifyToken` + `requireRole(EDIT_CLIENT_ROLES)` donde `EDIT_CLIENT_ROLES = ["comercial", "acp_comercial", "backoffice", "backoffice_comercial", "jefe_comercial", "gerencia", "gerente", "admin", "administrador", "ti"]`.

**Entradas:**
Body multipart con campos actualizables del cliente. Archivos opcionales (mismos 8 tipos que en el alta, incluyendo `approval_letter` y `consent_record` adicionales).

**Proceso:**
`clientsService.updateClient()` procesa los archivos recibidos en `req.files` (memoria), los sube a Drive mediante `uploadBase64File` y actualiza los `*_file_id` correspondientes en la base de datos junto con los campos de texto modificados.

**Salida:** `{ ok: true, data: { ...cliente actualizado } }`.

---

### FRS-COM-011 — Asignación de cliente a asesor

**Endpoint:** `POST /api/v1/clients/:id/assign`
**Acceso:** `verifyToken` + `requireRole(ASSIGN_CLIENT_ROLES)` donde `ASSIGN_CLIENT_ROLES = ["jefe_comercial", "gerencia", "gerente", "admin", "administrador", "ti"]`.

**Entradas:**
```json
{
  "assignee_email": "asesor@empresa.com",
  "temporary": false,
  "starts_at": "2026-06-18T00:00:00Z",
  "ends_at": null,
  "reason": "Reasignación por cobertura geográfica",
  "unassign": false
}
```

**Proceso:**
`clientsService.assignClient()` verifica que el asignado tenga un rol en `ASSIGNABLE_ADVISOR_ROLES` y que su estado de empleo no esté en `PASSIVE_EMPLOYMENT_STATUSES` (`pasivo`, `desvinculado`, `inactivo`). Si `unassign: true`, desactiva la asignación existente poniendo `is_active = false`. Si es una asignación nueva, inserta en `client_assignments` con el tipo `manual` o `temporary` según el flag `temporary`, respetando la restricción `UNIQUE(client_request_id, assigned_to_email)`.

**Salida:** `{ ok: true, data: { assignment_id, client_id, assigned_to, assignment_type, starts_at, ends_at } }`.

---

### FRS-COM-012 — Registro de estado de visita a cliente

**Endpoint:** `POST /api/v1/clients/:id/visit-status`
**Acceso:** `verifyToken` (sin `requireRole` explícito en ruta).

**Entradas:**
```json
{
  "status": "visited",
  "date": "2026-06-18",
  "hora_entrada": "2026-06-18T09:15:00Z",
  "hora_salida": "2026-06-18T10:30:00Z",
  "lat_entrada": -0.2298500,
  "lng_entrada": -78.5249500,
  "lat_salida": -0.2298500,
  "lng_salida": -78.5249500,
  "observaciones": "Reunión con gerente de compras"
}
```
Estados válidos: `visited`, `pending`, `skipped`, `in_visit`. Cualquier otro valor es rechazado con error de negocio.

**Proceso:**
`clientsService.upsertVisitStatus()` realiza un upsert en `client_visit_logs` por la restricción `UNIQUE(client_request_id, user_email, visit_date)`. Si la combinación ya existe, actualiza; si no, inserta. Cuando el estado es `visited` y hay `hora_entrada` y `hora_salida`, calcula y almacena `duracion_minutos`.

**Salida:** `{ ok: true, data: { id, status, visit_date, duracion_minutos, ... } }`.

---

### FRS-COM-013 — Registro de visita a prospecto

**Endpoint:** `POST /api/v1/clients/prospect-visit`
**Acceso:** `verifyToken` (sin `requireRole` explícito).

**Entradas:**
```json
{
  "prospect_name": "Empresa ABC S.A.",
  "visit_date": "2026-06-18",
  "check_in_time": "2026-06-18T08:00:00Z",
  "check_out_time": "2026-06-18T09:00:00Z",
  "check_in_lat": -0.229,
  "check_in_lng": -78.524,
  "check_out_lat": -0.229,
  "check_out_lng": -78.524,
  "observations": "Primer contacto, interés en servicio X",
  "visit_id": null
}
```

**Proceso:**
`clientsService.upsertProspectVisit()` registra o actualiza la visita al prospecto. Si se incluye `visit_id`, actualiza el registro existente; si no, crea uno nuevo asociado al usuario autenticado.

**Salida:** `{ ok: true, data: { id, prospect_name, visit_date, user_email, ... } }`.

---

### FRS-COM-014 — Registro de interacción CRM

**Endpoint:** `POST /api/v1/clients/:id/interactions`
**Acceso:** `verifyToken` + `requireRole(CRM_INTERACTION_ROLES)` — mismos roles que `EDIT_CLIENT_ROLES`.

**Entradas:**
```json
{
  "type": "call",
  "notes": "Seguimiento a cotización enviada la semana pasada"
}
```
Tipos aceptados: `call`, `llamada`, `phone_call`, `telefono` (normalizan a `call`); `visit`, `visita` (normalizan a `visit`).

**Proceso:**
`clientsService.registerInteraction()` pasa el tipo por `normalizeInteractionType()` que aplica el mapeo canónico. Persiste la interacción con el tipo normalizado, las notas, el `user_email` del actor y la marca de tiempo.

**Salida:** `{ ok: true, data: { id, client_id, type: 'call' | 'visit', notes, created_at } }` — HTTP 201.

---

### FRS-COM-015 — Historial CRM del cliente

**Endpoint:** `GET /api/v1/clients/:id/history`
**Acceso:** `verifyToken` + `requireRole(CRM_INTERACTION_ROLES)`.

**Entradas:** `id` en ruta. Query param opcional `limit` (número de registros).

**Proceso:**
`clientsService.getClientHistory()` consulta las interacciones registradas para el cliente, ordenadas por fecha descendente, con el límite especificado.

**Salida:** `{ ok: true, data: [{ id, type, notes, user_email, created_at }] }`.

---

### FRS-COM-016 — Gestión de sedes del cliente

**Endpoints:**
- `GET /api/v1/clients/:id/locations` — listar sedes (`CRM_INTERACTION_ROLES`)
- `POST /api/v1/clients/:id/locations` — agregar sede (`EDIT_CLIENT_ROLES`)
- `PUT /api/v1/clients/:id/locations/:locationId` — actualizar sede (`EDIT_CLIENT_ROLES`)
- `DELETE /api/v1/clients/:id/locations/:locationId` — eliminar sede (`EDIT_CLIENT_ROLES`)

**Entradas (alta/actualización):**
```json
{
  "name": "Sede Norte",
  "address": "Av. 10 de Agosto N20-15",
  "city": "Quito",
  "province": "Pichincha",
  "is_main": true,
  "lat": null,
  "lng": null
}
```

**Proceso:**
`clientsService.addLocation()` y `updateLocation()` normalizan el payload con `normalizeLocationPayload()`. Si no se proporcionan coordenadas manuales, invocan `geocodeAddress()` que construye la dirección completa como `"{address}, {city}, {province}, Ecuador"` y la envía a la Google Maps Geocoding API (región `ec`, idioma `es`, timeout 15 segundos). El resultado determina los campos `lat`, `lng`, `geocoded` y `geocode_status`. El fallo de geocodificación no bloquea la operación.

**Salida:**
- Listar: `{ ok: true, data: [{ id, name, address, city, province, lat, lng, is_main, geocoded }] }`.
- Alta/actualización: `{ ok: true, data: { id, ..., geocode_status: 'OK' | 'MISSING_API_KEY' | ... } }` — HTTP 201 para alta.
- Eliminación: `{ ok: true, data: { deleted: true } }`.

---

### FRS-COM-017 — Gestión de oportunidades comerciales

**Endpoints:**
- `GET /api/v1/opportunities` — listar oportunidades (`OPPORTUNITY_READ_ROLES`)
- `POST /api/v1/opportunities` — crear oportunidad (`OPPORTUNITY_WRITE_ROLES`)
- `GET /api/v1/opportunities/:id` — detalle (`OPPORTUNITY_READ_ROLES`)
- `PUT /api/v1/opportunities/:id` — actualizar (`OPPORTUNITY_WRITE_ROLES`)
- `GET /api/v1/opportunities/dashboard/manager` — dashboard gerencial (`OPPORTUNITY_READ_ROLES`)
- `GET /api/v1/opportunities/process-lookup/:type/:processId` — búsqueda de proceso vinculable (`OPPORTUNITY_READ_ROLES`)

**Entradas (creación/actualización):** Campos de la oportunidad incluyendo nombre, cliente relacionado, etapa, valor estimado, fecha esperada de cierre y campos adicionales del pipeline.

**Proceso:**
`controller.createOpportunity` y `controller.updateOpportunity` persisten en la tabla de oportunidades. `controller.getManagerDashboard` devuelve métricas agregadas. `controller.lookupProcess` consulta la tabla correspondiente según el `type` (`business_case` → `bc_master`, `private_purchase` → `private_purchase_requests`, `equipment_purchase` → `equipment_purchase_requests`) para validar que el proceso exista antes de vincularlo.

**Salida:** Listado/detalle: `{ ok: true, data: {...} }`. Dashboard: `{ ok: true, data: { total, by_stage: [...], ... } }`.

---

### FRS-COM-018 — Sub-elementos de oportunidades (influencias, flags, competidores, acciones, comentarios, vínculos)

**Endpoints:**
- `POST /api/v1/opportunities/:id/influences` / `DELETE /api/v1/opportunities/:id/influences/:influenceId`
- `POST /api/v1/opportunities/:id/flags` / `DELETE /api/v1/opportunities/:id/flags/:flagId`
- `POST /api/v1/opportunities/:id/competitors` / `DELETE /api/v1/opportunities/:id/competitors/:competitorId`
- `POST /api/v1/opportunities/:id/actions` / `DELETE /api/v1/opportunities/:id/actions/:actionId`
- `POST /api/v1/opportunities/:id/comments` / `DELETE /api/v1/opportunities/:id/comments/:commentId`
- `POST /api/v1/opportunities/:id/links` / `DELETE /api/v1/opportunities/:id/links/:linkId`

**Acceso:** `verifyToken` + `requireRole(OPPORTUNITY_WRITE_ROLES)` en todos.

**Proceso:** Cada controlador hace upsert o eliminación del sub-elemento correspondiente vinculado al ID de la oportunidad. `controller.linkProcess` verifica que el tipo y el ID del proceso existan antes de crear el vínculo.

**Salida:** `{ ok: true, data: { ...sub_elemento_creado_o_eliminado } }`.

---

### FRS-COM-019 — Gestión de cuentas y contactos

**Endpoints:**
- `GET /api/v1/opportunities/accounts` — listar cuentas (`OPPORTUNITY_READ_ROLES`)
- `POST /api/v1/opportunities/accounts` — crear cuenta (`OPPORTUNITY_WRITE_ROLES`)
- `GET /api/v1/opportunities/contacts` — listar contactos (`OPPORTUNITY_READ_ROLES`)
- `POST /api/v1/opportunities/contacts` — crear contacto (`OPPORTUNITY_WRITE_ROLES`)

**Entradas (cuenta):**
```json
{
  "name": "Empresa XYZ S.A.",
  "legal_name": "Empresa XYZ Sociedad Anónima",
  "tax_id": "1790123456001",
  "industry": "Farmacéutica",
  "city": "Guayaquil",
  "province": "Guayas",
  "country": "Ecuador",
  "website": "https://xyz.com",
  "notes": "Cliente estratégico"
}
```

**Proceso:**
`listAccounts()` acepta `q` (búsqueda en `name`, `legal_name`, `tax_id` con `ILIKE`) y `limit` (coercionado a rango `[1, 50]`). `createAccount()` valida que `name` no sea vacío (lanza error si lo es) e inserta en `accounts` incluyendo `created_by` y `updated_by` con el ID del actor.

**Salida:**
- Listar: `{ ok: true, data: [{ id, name, legal_name, tax_id, industry, city, province, country, website, client_id, created_at, updated_at }] }`.
- Crear: `{ ok: true, data: { id, name, ... } }` — HTTP 201.

---

## 4. Tabla de endpoints API completos

### Sub-dominio Requests

| Método | Ruta | Acceso | Función |
|---|---|---|---|
| `GET` | `/api/v1/requests/public/consent/:token` | Público | Otorgamiento de consentimiento LOPDP por cliente externo |
| `POST` | `/api/v1/requests/new-client/consent-token` | `verifyToken` | Envío de token de consentimiento por correo |
| `POST` | `/api/v1/requests/new-client/consent-token/verify` | `verifyToken` | Verificación del token de consentimiento |
| `POST` | `/api/v1/requests/new-client` | `verifyToken` | Creación de solicitud de nuevo cliente |
| `GET` | `/api/v1/requests/new-client/my` | `verifyToken` | Listado de solicitudes propias del usuario |
| `GET` | `/api/v1/requests/new-client` | `verifyToken` + 9 roles | Listado global de solicitudes de nuevo cliente |
| `GET` | `/api/v1/requests/new-client/summary` | `verifyToken` + 9 roles | Resumen estadístico de solicitudes |
| `GET` | `/api/v1/requests/new-client/:id` | `verifyToken` + 6 roles | Detalle de solicitud de nuevo cliente |
| `PUT` | `/api/v1/requests/new-client/:id/quality-checklist` | `verifyToken` + `calidad`, `jefe_calidad` | Actualización de checklist de calidad |
| `PUT` | `/api/v1/requests/new-client/:id/process` | `verifyToken` + `backoffice_comercial` | Aprobación o rechazo de solicitud |
| `PUT` | `/api/v1/requests/new-client/:id` | `verifyToken` | Corrección de solicitud devuelta |
| `POST` | `/api/v1/requests` | `verifyToken` + 3 roles | Creación de solicitud comercial general |
| `GET` | `/api/v1/requests` | `verifyToken` + 16 roles | Listado de solicitudes |
| `GET` | `/api/v1/requests/:id` | `verifyToken` + 16 roles | Detalle de solicitud |
| `PUT` | `/api/v1/requests/:id/resubmit` | `verifyToken` + `jefe_comercial` | Reenvío tras rechazo |
| `POST` | `/api/v1/requests/:id/cancel` | `verifyToken` + `jefe_comercial` | Cancelación de solicitud |

### Sub-dominio Clients

| Método | Ruta | Acceso | Función |
|---|---|---|---|
| `GET` | `/api/v1/clients` | `verifyToken` | Listado de clientes con filtros (visibilidad por rol en servicio) |
| `POST` | `/api/v1/clients/prospect-visit` | `verifyToken` | Registro de visita a prospecto |
| `POST` | `/api/v1/clients/:id/visit-status` | `verifyToken` | Upsert de estado de visita con georreferenciación |
| `POST` | `/api/v1/clients/:id/interactions` | `verifyToken` + `CRM_INTERACTION_ROLES` | Registro de interacción CRM |
| `GET` | `/api/v1/clients/:id/history` | `verifyToken` + `CRM_INTERACTION_ROLES` | Historial de interacciones del cliente |
| `GET` | `/api/v1/clients/:id/locations` | `verifyToken` + `CRM_INTERACTION_ROLES` | Listado de sedes del cliente |
| `POST` | `/api/v1/clients/:id/locations` | `verifyToken` + `EDIT_CLIENT_ROLES` | Alta de sede con geocodificación |
| `PUT` | `/api/v1/clients/:id/locations/:locationId` | `verifyToken` + `EDIT_CLIENT_ROLES` | Actualización de sede con geocodificación |
| `DELETE` | `/api/v1/clients/:id/locations/:locationId` | `verifyToken` + `EDIT_CLIENT_ROLES` | Eliminación de sede |
| `GET` | `/api/v1/clients/:id` | `verifyToken` | Detalle de cliente |
| `PUT` | `/api/v1/clients/:id` | `verifyToken` + `EDIT_CLIENT_ROLES` | Actualización de datos y documentos del cliente |
| `POST` | `/api/v1/clients/:id/assign` | `verifyToken` + `ASSIGN_CLIENT_ROLES` | Asignación / desasignación de cliente a asesor |

### Sub-dominio Opportunities

| Método | Ruta | Acceso | Función |
|---|---|---|---|
| `GET` | `/api/v1/opportunities/accounts` | `verifyToken` + `OPPORTUNITY_READ_ROLES` | Listado de cuentas con búsqueda |
| `POST` | `/api/v1/opportunities/accounts` | `verifyToken` + `OPPORTUNITY_WRITE_ROLES` | Creación de cuenta |
| `GET` | `/api/v1/opportunities/contacts` | `verifyToken` + `OPPORTUNITY_READ_ROLES` | Listado de contactos |
| `POST` | `/api/v1/opportunities/contacts` | `verifyToken` + `OPPORTUNITY_WRITE_ROLES` | Creación de contacto |
| `GET` | `/api/v1/opportunities/dashboard/manager` | `verifyToken` + `OPPORTUNITY_READ_ROLES` | Dashboard gerencial de oportunidades |
| `GET` | `/api/v1/opportunities/process-lookup/:type/:processId` | `verifyToken` + `OPPORTUNITY_READ_ROLES` | Búsqueda de proceso para vinculación |
| `GET` | `/api/v1/opportunities` | `verifyToken` + `OPPORTUNITY_READ_ROLES` | Listado de oportunidades |
| `POST` | `/api/v1/opportunities` | `verifyToken` + `OPPORTUNITY_WRITE_ROLES` | Creación de oportunidad |
| `GET` | `/api/v1/opportunities/:id` | `verifyToken` + `OPPORTUNITY_READ_ROLES` | Detalle de oportunidad |
| `PUT` | `/api/v1/opportunities/:id` | `verifyToken` + `OPPORTUNITY_WRITE_ROLES` | Actualización de oportunidad |
| `POST` / `DELETE` | `/api/v1/opportunities/:id/influences/:influenceId?` | `verifyToken` + `OPPORTUNITY_WRITE_ROLES` | Upsert / eliminación de influencia |
| `POST` / `DELETE` | `/api/v1/opportunities/:id/flags/:flagId?` | `verifyToken` + `OPPORTUNITY_WRITE_ROLES` | Upsert / eliminación de flag |
| `POST` / `DELETE` | `/api/v1/opportunities/:id/competitors/:competitorId?` | `verifyToken` + `OPPORTUNITY_WRITE_ROLES` | Upsert / eliminación de competidor |
| `POST` / `DELETE` | `/api/v1/opportunities/:id/actions/:actionId?` | `verifyToken` + `OPPORTUNITY_WRITE_ROLES` | Upsert / eliminación de acción |
| `POST` / `DELETE` | `/api/v1/opportunities/:id/comments/:commentId?` | `verifyToken` + `OPPORTUNITY_WRITE_ROLES` | Creación / eliminación de comentario |
| `POST` / `DELETE` | `/api/v1/opportunities/:id/links/:linkId?` | `verifyToken` + `OPPORTUNITY_WRITE_ROLES` | Vinculación / desvinculación de proceso |

---

## 5. Controles de acceso y seguridad funcional

### Middlewares aplicados
- `verifyToken` — declarado en `clients.routes.js` línea 38 con `router.use(verifyToken)` y en `requests.routes.js` con `verifyToken` por ruta. Valida el JWT en cada request.
- `requireRole(roles[])` — guard de autorización que rechaza con HTTP 403 si el rol del usuario no está en la lista permitida.

### Grupos de roles definidos en código
| Constante | Roles | Uso |
|---|---|---|
| `EDIT_CLIENT_ROLES` | `comercial`, `acp_comercial`, `backoffice`, `backoffice_comercial`, `jefe_comercial`, `gerencia`, `gerente`, `admin`, `administrador`, `ti` | Edición de cliente y sedes; interacciones CRM |
| `ASSIGN_CLIENT_ROLES` | `jefe_comercial`, `gerencia`, `gerente`, `admin`, `administrador`, `ti` | Asignación de clientes |
| `CRM_INTERACTION_ROLES` | Igual que `EDIT_CLIENT_ROLES` | Interacciones, historial, sedes (lectura) |
| `FULL_ACCESS_ROLES` (servicio) | `jefe_comercial`, `acp_comercial`, `backoffice`, `backoffice_comercial`, `gerencia`, `gerente`, `admin`, `administrador`, `ti` | Visibilidad completa de cartera en listado |
| `FIELD_CLIENT_READ_ROLES` (servicio) | `tecnico`, `jefe_tecnico`, `servicio_tecnico`, `jefe_servicio_tecnico`, `logistica`, `jefe_logistica` | Lectura limitada de clientes (sin cartera comercial) |
| `ODOO_SYNC_ALLOWED_ROLES` (servicio) | `jefe_comercial`, `jefe_de_comercial`, `gerencia`, `gerente`, `admin`, `administrador`, `ti` | Sincronización con Odoo CRM |
| `OPPORTUNITY_READ_ROLES` | `comercial`, `asesor_comercial`, `analista_comercial`, `backoffice_comercial`, `acp_comercial`, `jefe_comercial`, `gerencia`, `gerencia_general`, `director`, `operaciones`, `jefe_operaciones`, `servicio_tecnico`, `jefe_tecnico` | Lectura de oportunidades y cuentas |
| `OPPORTUNITY_WRITE_ROLES` | Subconjunto sin `operaciones`, `jefe_operaciones`, `servicio_tecnico`, `jefe_tecnico` | Escritura en oportunidades y cuentas |

### Endpoint público
`GET /api/v1/requests/public/consent/:token` — no tiene `verifyToken` ni `requireRole`. Es accedido por el cliente externo desde un enlace de correo. No expone datos privados; solo registra el consentimiento cuando el token es válido.

---

## 6. Dependencias funcionales

| Dependencia | Tipo | Función en el módulo |
|---|---|---|
| `schedules.service` | Interna | Consultada en `listAccessibleClients()` para incluir metadatos de cronograma |
| `integrations/odooClient` | Externa opcional | Sincronización de clientes; `callOdoo()` en operaciones de escritura cuando `isCrmSyncEnabled()` es verdadero |
| `integrations/integrationOutbox.service` | Interna | `enqueueIntegrationEvent()` para despacho asíncrono de eventos a integraciones externas |
| `notifications/notificationManager` | Interna | Notificaciones disparadas desde `opportunities.service.js` |
| `config/crmDb` — `isCrmSyncEnabled()` | Configuración | Guard que determina si la integración Odoo está activa |
| `utils/drive` — `uploadBase64File()` | Utilidad | Subida de archivos a Google Drive |
| Google Maps Geocoding API | Externa opcional | Geocodificación de sedes; timeout 15 s; fallo no bloquea el flujo |

---

## 7. Observaciones técnicas y riesgos

- **Control de acceso en la capa de servicio para `/clients` (listado y detalle):** Las rutas `GET /api/v1/clients` y `GET /api/v1/clients/:id` no tienen `requireRole` en la capa de ruta. El filtrado por cartera y la verificación de acceso se realiza dentro de `clientsService.listAccessibleClients()` y `clientsService.getClientDetail()`. Este patrón es correcto funcionalmente pero requiere que los tests unitarios del servicio cubran todos los paths de rol para evitar regresiones silenciosas.
- **Asignaciones temporales sin enforcement automático de expiración:** La condición `ACTIVE_ASSIGNMENT_CONDITION` evalúa `ends_at >= NOW()` en cada consulta, pero no existe un job programado que desactive automáticamente las asignaciones vencidas. Las asignaciones expiradas dejan de ser devueltas por las consultas pero siguen con `is_active = true` en la base de datos.
- **Dependencia de Google Drive para continuidad del flujo de documentos:** Si `uploadBase64File` falla, la operación de creación o actualización de cliente/solicitud puede quedar en estado inconsistente (registro creado sin archivo). No se observa un mecanismo de rollback o reintento en el código analizado.
- **Integración Odoo como canal secundario:** La sincronización con Odoo está condicionada a `isCrmSyncEnabled()`. Cuando está activa, agrega latencia a las operaciones de escritura de clientes. Los eventos también se despachan via `enqueueIntegrationEvent()` para desacoplamiento asíncrono.
