# CONTEXT.md — clients

## 1. Descripción
Módulo CRM de gestión de clientes. Permite listar, ver detalle, actualizar clientes, gestionar ubicaciones/sucursales, registrar interacciones comerciales, visitas de prospección y asignación de ejecutivos de cuenta.

## 2. Endpoints

- **GET /api/v1/clients/** — `listClients` — verifyToken — todos autenticados
- **POST /api/v1/clients/prospect-visit** — `registerProspectVisit` — verifyToken — todos autenticados
- **POST /api/v1/clients/:id/visit-status** — `setVisitStatus` — verifyToken — todos autenticados
- **POST /api/v1/clients/:id/interactions** — `registerInteraction` — verifyToken, requireRole(CRM_INTERACTION_ROLES)
  - Roles: `comercial`, `acp_comercial`, `backoffice`, `backoffice_comercial`, `jefe_comercial`, `gerencia`, `gerente`, `admin`, `administrador`, `ti`
- **GET /api/v1/clients/:id/history** — `getClientHistory` — verifyToken, requireRole(CRM_INTERACTION_ROLES)
- **GET /api/v1/clients/:id/locations** — `listClientLocations` — verifyToken, requireRole(CRM_INTERACTION_ROLES)
- **POST /api/v1/clients/:id/locations** — `addClientLocation` — verifyToken, requireRole(EDIT_CLIENT_ROLES)
  - Roles: `comercial`, `acp_comercial`, `backoffice`, `backoffice_comercial`, `jefe_comercial`, `gerencia`, `gerente`, `admin`, `administrador`, `ti`
- **PUT /api/v1/clients/:id/locations/:locationId** — `updateClientLocation` — verifyToken, requireRole(EDIT_CLIENT_ROLES)
- **DELETE /api/v1/clients/:id/locations/:locationId** — `removeClientLocation` — verifyToken, requireRole(EDIT_CLIENT_ROLES)
- **GET /api/v1/clients/:id** — `getClientDetail` — verifyToken — todos autenticados
- **PUT /api/v1/clients/:id** — `updateClient` — verifyToken, requireRole(EDIT_CLIENT_ROLES), multer.fields (documentos legales)
- **POST /api/v1/clients/:id/assign** — `assignClient` — verifyToken, requireRole(ASSIGN_CLIENT_ROLES)
  - Roles: `jefe_comercial`, `gerencia`, `gerente`, `admin`, `administrador`, `ti`

## 3. Flujo principal

1. Comercial o jefe lista clientes activos via `GET /clients/`
2. Se registran interacciones CRM (visitas, llamadas)
3. Se gestionan ubicaciones/sucursales del cliente
4. Jefe comercial asigna ejecutivo de cuenta
5. Se actualizan documentos legales del cliente (RUC, permiso de operación, etc.)

## 4. Validaciones
- `multer.memoryStorage()` para subida de documentos
- 3 grupos de roles diferenciados: lectura, edición, asignación
- Archivos aceptados en PUT: `legal_rep_appointment_file`, `ruc_file`, `id_file`, `bpadt_certification_file`, `operating_permit_file`, `consent_evidence_file`, `approval_letter`, `consent_record`

## 5. Base de datos
- No verificado en DB

## 6. Relaciones
- `integrations`/Odoo: `clients.service.js` (71KB) sugiere sincronización con Odoo
- `requests`: flujo de nuevos clientes inicia en requests y crea registros aquí
- `business-case`: referencias a clientes para propuestas comerciales

## 7. Frontend asociado
- `/dashboard/comercial/clientes` → `ClientesPage`
- `/dashboard/clientes` → `ClientesPage`

## 8. Riesgos detectados
- `clients.service.js` (71KB) — extremadamente grande, alta deuda técnica
- `GET /clients/:id` sin restricción de rol — cualquier usuario autenticado ve detalle

## 9. Notas técnicas
- Migración `148_clients_odoo_identity_sync.sql` activa — sincronización con Odoo
