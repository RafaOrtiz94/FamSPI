# CONTEXT.md — requests

## 1. Descripción
Módulo de solicitudes comerciales y de nuevos clientes. Gestiona dos flujos: (1) solicitudes generales del área comercial, y (2) solicitudes de registro de nuevos clientes con verificación LOPDP, checklist de calidad, y procesamiento por backoffice.

## 2. Endpoints

**Flujo Nuevos Clientes:**
- **GET /api/v1/requests/public/consent/:token** — `grantConsent` — pública (LOPDP)
- **POST /api/v1/requests/new-client/consent-token** — `sendConsentEmailToken` — verifyToken
- **POST /api/v1/requests/new-client/consent-token/verify** — `verifyConsentEmailToken` — verifyToken
- **POST /api/v1/requests/new-client** — `createClientRequest` — verifyToken, multer.fields (documentos legales)
- **GET /api/v1/requests/new-client/my** — `listClientRequests` — verifyToken
- **GET /api/v1/requests/new-client** — `listClientRequests` — verifyToken, requireRole(`backoffice_comercial`, `gerencia`, `calidad`, `jefe_calidad`, `comercial`, `jefe_comercial`, `acp_comercial`, `ti`, `jefe_ti`)
- **GET /api/v1/requests/new-client/summary** — `getClientRequestSummary` — mismos roles
- **GET /api/v1/requests/new-client/:id** — `getClientRequestById` — requireRole limitado
- **PUT /api/v1/requests/new-client/:id/quality-checklist** — `updateClientRequestQualityChecklist` — requireRole(`calidad`, `jefe_calidad`)
- **PUT /api/v1/requests/new-client/:id/process** — `processClientRequest` — requireRole(`backoffice_comercial`)
- **PUT /api/v1/requests/new-client/:id** — `updateClientRequest` — verifyToken, multer.fields

**Flujo Solicitudes Generales:**
- **POST /api/v1/requests/** — `createRequest` — verifyToken, requireRole(`jefe_comercial`, `comercial`, `backoffice_comercial`), multer.fields(`files[]`)
- **GET /api/v1/requests/** — `listRequests` — verifyToken, requireRole(múltiples roles)
- **GET /api/v1/requests/:id** — `getDetail` — verifyToken, requireRole(mismos roles)
- **PUT /api/v1/requests/:id/resubmit** — `resubmit` — verifyToken, requireRole(`jefe_comercial`)
- **POST /api/v1/requests/:id/cancel** — `cancel` — verifyToken, requireRole(`jefe_comercial`)

## 3. Flujo principal

**Nuevo Cliente:**
1. Comercial envía token de consentimiento LOPDP al cliente
2. Cliente acepta via URL pública
3. Comercial crea solicitud con documentos legales
4. Calidad completa el checklist de aprobación
5. Backoffice procesa (aprueba/rechaza) la solicitud

**Solicitud General:**
1. Jefe/Comercial crea solicitud con archivos adjuntos
2. Múltiples roles consultan y gestionan
3. Se puede reenviar tras rechazo o cancelar

## 4. Validaciones
- `requestSchemas.js` (10KB): esquemas de validación
- `purchaseRequestsFacade.js` (21KB): fachada para compras
- Documentos requeridos: `legal_rep_appointment_file`, `ruc_file`, `id_file`, `bpadt_certification_file`, `operating_permit_file`, `consent_evidence_file`

## 5. Base de datos
- No verificado en DB

## 6. Relaciones
- `clients`: la aprobación de una solicitud de nuevo cliente crea un cliente en el módulo clients
- `notifications`: notificaciones en cada etapa del flujo
- `files`: adjuntos de solicitudes

## 7. Frontend asociado
- `/dashboard/backoffice/client-requests` → `ClientRequests`
- `/dashboard/backoffice/client-request/:id` → `ClientRequestReview`
- `/dashboard/comercial/solicitudes` → `SolicitudesPage`

## 8. Riesgos detectados
- `requests.service.js` (119KB) — muy grande
- Ruta pública `/public/consent/:token` sin limitación de intentos (no se verificó rate limit)

## 9. Notas técnicas
- Módulo central que conecta comercial con backoffice y calidad
- `__tests__` presente
