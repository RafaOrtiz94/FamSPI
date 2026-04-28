# CONTEXT.md — viaticos

## 1. Descripción
Módulo de gestión de viáticos para colaboradores. Cubre el ciclo completo: solicitud, revisión de facturas, aprobación por finanzas, configuración de zonas y perfiles fijos, generación de reportes y exportación ATS-XML para el SRI.

## 2. Endpoints

- **GET /api/v1/viaticos/candidates** — `listCandidates` — verifyToken, requireRole(módulo completo)
- **GET /api/v1/viaticos/reports/summary** — `reportSummary` — requireRole(FINANCE_REVIEWER_ROLES)
  - Roles: `finanzas`, `jefe_financiero`, `jefe_finanzas`
- **GET /api/v1/viaticos/ats/xml** — `atsXml` — requireRole(FINANCE_REVIEWER_ROLES)
- **GET /api/v1/viaticos/** — `list` — verifyToken + requireRole general
- **POST /api/v1/viaticos/** — `upsert` — verifyToken + requireRole general
- **PATCH /api/v1/viaticos/:id/status** — `updateStatus` — requireRole(FINANCE_REVIEWER_ROLES)
- **POST /api/v1/viaticos/config/zones** — `upsertZone` — requireRole(`finanzas`, `admin`, `administrador`, `gerencia_general`)
- **POST /api/v1/viaticos/config/fixed-profiles** — `upsertFixedProfile` — mismos roles
- **GET /api/v1/viaticos/config/fixed-profiles** — `listFixedProfiles` — mismos roles
- **PATCH /api/v1/viaticos/config/policy** — `updatePolicy` — mismos roles
- **GET /api/v1/viaticos/:id/documents** — `listDocuments`
- **POST /api/v1/viaticos/:id/documents** — `addDocument`
- **POST /api/v1/viaticos/sync-sri** — `syncSri`
- **POST /api/v1/viaticos/:id/invoices/xml** — `uploadInvoiceXml`
- **GET /api/v1/viaticos/:id/invoices** — `listInvoices`
- **PATCH /api/v1/viaticos/invoices/:invoiceId** — `patchInvoice` — requireRole(FINANCE_REVIEWER_ROLES)
- **GET /api/v1/viaticos/:id/report** — `report` — requireRole(FINANCE_REVIEWER_ROLES)

Roles base del módulo (router-level):
`finanzas`, `comercial`, `backoffice_comercial`, `servicio_tecnico`, `tecnico`, `jefe_comercial`, `jefe_tecnico`, `jefe_servicio_tecnico`, `jefe_operaciones`, `admin`, `administrador`, `gerencia_general`

## 3. Flujo principal

1. Colaborador crea solicitud de viáticos via `POST /viaticos/`
2. Sube facturas en XML del SRI via `POST /:id/invoices/xml`
3. Finanzas revisa facturas y ajusta estado via `PATCH /invoices/:invoiceId`
4. Finanzas aprueba/rechaza la liquidación via `PATCH /:id/status`
5. Finanzas genera reporte consolidado y exporta ATS-XML

## 4. Validaciones
- Dos niveles de acceso: solicitante (amplio) y revisor financiero (restringido)
- Sincronización con SRI para validación de facturas

## 5. Base de datos
- No verificado en DB

## 6. Relaciones
- `files`/Drive: probable para almacenamiento de documentos de respaldo
- SRI (externo): integración para sincronización de comprobantes

## 7. Frontend asociado
- `/dashboard/finanzas/viaticos` → `ViaticosWorkspace`
- Roles con acceso: `finanzas`, `comercial`, `backoffice_comercial`, `servicio_tecnico`, `tecnico`, `jefe_comercial`, `jefe_tecnico`, `jefe_servicio_tecnico`

## 8. Riesgos detectados
- `viaticos.service.js` (90KB) — extremadamente grande
- `POST /viaticos/` usa `upsert` (crear + actualizar) — puede generar duplicados si no se valida correctamente

## 9. Notas técnicas
- Exportación ATS-XML compatible con SRI Ecuador
- Módulo activo con workspace dedicado en frontend
