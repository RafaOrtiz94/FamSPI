# CONTEXT.md — requests

## 1. Descripción
Módulo genérico de "Solicitudes" (Solicitudes). Es el backend real detrás de la pantalla **Solicitudes** del área comercial (`/dashboard/comercial/solicitudes` y la ruta legacy `/requests`). Gestiona DOS flujos independientes sobre la misma tabla `requests` (formularios F.ST-19/20/21/22, F.VE-02, etc.) más un sub-flujo propio para altas de cliente:

1. **Solicitudes generales** (tabla `requests`): compra, inspección, retiro de equipo, crédito (F.VE-02), personal — cualquier `request_type_id` catalogado en `request_types`.
2. **Solicitudes de nuevo cliente** (tabla `client_requests`): flujo con verificación LOPDP (consentimiento), documentos legales, checklist de calidad y aprobación de backoffice.

**No tiene relación funcional con `delivery-requests`** (ver `backend/src/modules/delivery-requests/CONTEXT.md`) — ese módulo gestiona entregas parciales de reactivos/calibradores sobre un `delivery_ceiling`, tabla y dominio totalmente distintos, sin ningún join ni import cruzado entre ambos módulos. Coinciden solo en el nombre "request" y en que ambos los usan roles comerciales.

Controller: `requests.controller.js`. Service: `requests.service.js` (119KB — el archivo más grande del módulo, contiene ambos flujos mezclados).

## 2. Roles

No hay un grupo `businessRoles` centralizado en este módulo — cada ruta declara su propio array de roles inline (a diferencia de `business-case`, que usa constantes reutilizables). Grupos observados:

### Solicitudes generales — lectura (`listRequests` / `getDetail`)
```
gerencia, comercial, acp_comercial, backoffice_comercial,
tecnico, ing_servicio, esp_app,
finanzas, jefe_financiero,
calidad, jefe_calidad,
jefe_servicio_tecnico, jefe_tecnico, jefe_servicio,
operaciones, jefe_operaciones,
ti, jefe_ti,
talento_humano, jefe_talento_humano
```
(`jefe_comercial` NO está en esta lista explícita — ver Riesgos §8)

### Solicitudes generales — creación (`createRequest`)
```
jefe_comercial, comercial, backoffice_comercial
```

### Reenvío / cancelación (`resubmit`, `cancel`)
```
jefe_comercial
```

### Decisión de crédito (`processCreditDecision`, F.VE-02)
```
jefe_financiero
```

### Resultado de inspección F.ST-07 (`registerInspectionResult`)
```
jefe_tecnico, jefe_servicio, jefe_servicio_tecnico
```

### Nuevo cliente — listado/consulta (`listClientRequests` completo, `getClientRequestSummary`)
```
backoffice_comercial, gerencia, calidad, jefe_calidad,
comercial, jefe_comercial, acp_comercial, ti, jefe_ti
```
`GET /new-client/my` no exige rol — solo `verifyToken` (el service filtra por `created_by`).

### Nuevo cliente — checklist de calidad
```
calidad, jefe_calidad
```

### Nuevo cliente — procesar (aprobar/rechazar)
```
backoffice_comercial
```

## 3. Endpoints

Prefijo: `/api/v1/requests`

### Flujo Nuevo Cliente
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| GET | `/public/consent/:token` | `grantConsent` | pública (LOPDP, sin auth) |
| POST | `/new-client/consent-token` | `sendConsentEmailToken` | verifyToken (cualquier autenticado) |
| POST | `/new-client/consent-token/verify` | `verifyConsentEmailToken` | verifyToken |
| POST | `/new-client` | `createClientRequest` | verifyToken, multer.fields (6 documentos legales) |
| GET | `/new-client/my` | `listClientRequests` | verifyToken (filtra por `created_by`) |
| GET | `/new-client` | `listClientRequests` | backoffice_comercial, gerencia, calidad, jefe_calidad, comercial, jefe_comercial, acp_comercial, ti, jefe_ti |
| GET | `/new-client/summary` | `getClientRequestSummary` | mismos roles que arriba |
| GET | `/new-client/:id` | `getClientRequestById` | backoffice_comercial, gerencia, calidad, jefe_calidad, comercial, jefe_comercial |
| PUT | `/new-client/:id/quality-checklist` | `updateClientRequestQualityChecklist` | calidad, jefe_calidad |
| PUT | `/new-client/:id/process` | `processClientRequest` | backoffice_comercial |
| PUT | `/new-client/:id` | `updateClientRequest` | verifyToken, multer.fields (corrección) |

### Flujo Solicitudes Generales
| Método | Ruta | Handler | Roles |
|--------|------|---------|-------|
| POST | `/` | `createRequest` | jefe_comercial, comercial, backoffice_comercial — multer `files[]`/`files` (máx 10) |
| GET | `/` | `listRequests` | ver lista §2 (lectura general) |
| POST | `/:id/credit-decision` | `processCreditDecision` | jefe_financiero |
| GET | `/:id` | `getDetail` | ver lista §2 |
| PUT | `/:id/resubmit` | `resubmit` | jefe_comercial |
| POST | `/:id/cancel` | `cancel` | jefe_comercial |
| POST | `/:id/inspection-result` | `registerInspectionResult` | jefe_tecnico, jefe_servicio, jefe_servicio_tecnico |

## 4. Flujo principal

**Nuevo Cliente:**
1. Comercial envía token de consentimiento LOPDP al cliente (`POST /new-client/consent-token`)
2. Cliente otorga consentimiento vía URL pública (`GET /public/consent/:token`)
3. Comercial crea la solicitud con documentos legales adjuntos (`POST /new-client`)
4. Calidad completa el checklist de aprobación (`PUT /new-client/:id/quality-checklist`)
5. Backoffice procesa (aprueba/rechaza) la solicitud (`PUT /new-client/:id/process`) → aprobación crea un cliente en el módulo `clients`

**Solicitud General:**
1. Jefe comercial/comercial/backoffice crea solicitud con archivos adjuntos, tipo resuelto por `request_type_id` (código F.ST-xx / F.VE-02) contra `request_types`
2. Se guarda una entrada inicial en `request_versions` (versionado de payload)
3. Múltiples roles consultan (lectura amplia, ver §2 — nótese que `jefe_comercial` no figura explícito en `listRequests`/`getDetail`, ver Riesgos)
4. F.VE-02 (crédito): `jefe_financiero` aprueba/rechaza vía `processCreditDecision`
5. F.ST-07 (inspección): coordinador técnico registra resultado vía `registerInspectionResult`
6. Se puede reenviar tras rechazo (`resubmit`, solo jefe_comercial) o cancelar (`cancel`, solo jefe_comercial)

## 5. Base de datos

No hay migración en `backend/migrations/` que cree las tablas `requests`, `request_types`, `request_versions`, `request_attachments`, `request_approvals` ni `client_requests` — son anteriores a la numeración de `migrations/` (creadas directo en el schema). Solo hay migraciones que las **alteran**:
- `migrations/044_purchase_requests_legacy_mapping.sql` — mapeo legacy sobre `request_types`/relacionadas
- `migrations/092_client_assignments_temporal_reassignment.sql` — reasignación temporal sobre `client_assignments`

**Tablas — flujo general:**
- `requests` — tabla principal (`request_group_id`, `requester_id`, `request_type_id`, `payload` JSON, `status`, `version_number`)
- `request_types` — catálogo de tipos (`code` F.ST-19/20/21/22, F.VE-02, `title`)
- `request_versions` — historial de versiones del `payload`
- `request_attachments` — adjuntos (Drive: `drive_file_id`, `drive_link`, `content_hash_sha256`)
- `request_approvals` — aprobaciones/decisiones por solicitud (`approver_id`, `action`, `comments`)

**Tablas — flujo nuevo cliente:**
- `client_requests` — tabla principal (`commercial_name`, `ruc_cedula`, `status`, `lopdp_token`, `consent_record_file_id`, `approval_letter_file_id`, `external_source`/`external_id`)
- `client_request_quality_checks` — checklist de calidad (FK `client_request_id`)
- `client_assignments` — asignación de cliente aprobado (FK `client_request_id`)

Estas tablas se auto-migran en runtime al primer uso (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` dentro de `requests.service.js`, líneas ~169-194 y ~406-408) — patrón similar al de `delivery-requests` (ver ese CONTEXT.md), no hay migración SQL dedicada para varios de estos cambios.

## 6. Relaciones con otros módulos
- `clients`: aprobar una `client_request` crea un registro en el módulo `clients`
- `notifications`: notificaciones en cada etapa de ambos flujos
- `files` + Google Drive: adjuntos de solicitudes (`request_attachments`, documentos legales de `client_requests`)
- `purchaseRequestsFacade.js` (21KB, dentro de este módulo): fachada que conecta solicitudes de tipo compra con el flujo de compras (`equipment-purchases`/`private-purchases`)

## 7. Frontend asociado

**Producción (rutas reales montadas en `AppRoutes.jsx`):**
- `/dashboard/comercial/solicitudes` → `spi_front/src/modules/comercial/pages/Solicitudes.jsx` (`SolicitudesPage`) — hub principal de "Solicitudes" para comercial/ACP/jefe_comercial/jefe_financiero, con vistas por rol (`ComercialSolicitudesView`, `ACPComercialSolicitudesView`, `JefeFinancieroSolicitudesView`, `UserRequestsView`) y modales de creación por tipo (`CreateRequestModal`, `CreditRequestModal`). Consume `core/api/requestsApi.js` → `/api/v1/requests`.
- `/requests` → `spi_front/src/modules/RequestsPage.jsx` (`RequestsPage`, **no** el archivo homónimo de `comercial/pages/`) — página alternativa/genérica, mismo backend (`getRequests`, `getRequestById`, `createRequest` de `requestsApi.js`), con `role === "jefe_comercial"` como único que puede crear. Ruta activa aunque redundante con `/dashboard/comercial/solicitudes` (ver Riesgos).
- `/dashboard/backoffice/client-requests` → `ClientRequests` (backoffice, flujo nuevo cliente)
- `/dashboard/backoffice/client-request/:id` → `ClientRequestReview`

**Legacy / no enrutado (código muerto confirmado):**
- `spi_front/src/modules/comercial/pages/Requests.jsx` — componente `Requests`, usa `DashboardLayout` + `SolicitudesGrid`, llama a `getRequests`/`getRequestById`/`cancelRequest` del mismo `requestsApi.js`. **Sin importador en `AppRoutes.jsx` ni en ningún otro archivo** (confirmado por grep) — no está montado en ninguna ruta. Probable versión anterior de la página, reemplazada por `Solicitudes.jsx` y/o `RequestsPage.jsx` mas nunca borrada.
- `spi_front/src/modules/comercial/pages/RequestActionsExample.jsx` — página de demostración explícita ("Página de ejemplo que muestra todos los tipos de botones de solicitud disponibles"), sin importador en ningún archivo del frontend (confirmado por grep). Es documentación viva de `RequestActionCards` component, no una pantalla real.

## 8. Riesgos detectados
- `requests.service.js` (119KB) — mezcla ambos flujos (general + nuevo cliente) en un solo archivo enorme; cambios en uno pueden afectar al otro por funciones compartidas
- Ruta pública `/public/consent/:token` sin rate limit verificado — superficie de abuso potencial (enumeración de tokens)
- `jefe_comercial` no aparece en el array de roles de `GET /` ni `GET /:id` (listado/detalle general) pese a que sí puede crear, reenviar y cancelar — posible gap de permisos si un jefe_comercial necesita ver el detalle de una solicitud ajena
- Tres páginas de frontend con nombre "Requests"/"Solicitudes" coexisten (`Solicitudes.jsx` en producción, `RequestsPage.jsx` en producción bajo `/requests`, `Requests.jsx` sin ruta) — alto riesgo de editar la que no corresponde; confirmar SIEMPRE con grep de imports en `AppRoutes.jsx` antes de tocar cualquiera de las tres
- Tablas core (`requests`, `client_requests`, etc.) no tienen migración de creación rastreable en `backend/migrations/` — el esquema real vive fuera del historial versionado para estas tablas

## 9. Notas técnicas
- Módulo central que conecta comercial con backoffice, calidad y finanzas (crédito)
- `__tests__` presente
- `purchaseRequestsFacade.js` — punto de integración con compras, revisar antes de tocar flujo de solicitudes tipo "compra"
- `requestSchemas.js` (10KB) — validación de payloads por tipo de solicitud
