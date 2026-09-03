# CONTEXT.md — equipment-purchases

## 1. Descripción
Módulo de compras de equipos (proceso comercial de adquisición). Gestiona el flujo completo desde la creación de la orden hasta la entrega, incluyendo proformas, contratos, inspecciones técnicas, entrega e instalación. Incluye SSE para actualizaciones en tiempo real y calendar de agenda técnica.

## 2. Endpoints principales

Prefijo: `/api/v1/equipment-purchases`

- **GET /events** — SSE streaming — requireRole(viewerRoles)
- **GET /meta** — `getMeta` — requireRole(creatorRoles)
- **GET /provider-contacts** — `listProviderContacts` — requireRole(managerRoles)
- **GET /stats** — `getStats` — requireRole(managerRoles)
- **GET /technical-schedule** — `getTechnicalScheduleCalendar` — requireRole(viewerRoles)
- **GET /** — `listMine` — requireRole(viewerRoles)
- **GET /:id** — `getOne` — requireRole(viewerRoles)
- **POST /** — `create` — requireRole(creatorRoles)
- **POST /provider-contacts** — `saveProviderContact` — requireRole(managerRoles)
- **POST /:id/start-availability** — `startAvailability` — requireRole(managerRoles)
- **POST /:id/provider-response** — `saveProviderResponse` — requireRole(managerRoles)
- **POST /:id/request-proforma** — `requestProforma` — requireRole(managerRoles)
- **POST /:id/upload-proforma** — `uploadProforma` — requireRole(managerRoles) + multer
- **POST /:id/reserve** — `reserve` — requireRole(managerRoles)
- **POST /:id/upload-signed-proforma** — requireRole(`acp_comercial`)
- **POST /:id/upload-contract** — `uploadContract` — requireRole(managerRoles)
- **POST /:id/request-delivery-dates** — requireRole(deliveryRoles)
- **POST /:id/mark-equipment-arrived** — requireRole(deliveryRoles)
- **POST /:id/mark-dispatch-ready** — requireRole(deliveryRoles)
- **POST /:id/complete-delivery** — requireRole(deliveryRoles)
- **POST /:id/cancel-order** — requireRole(managerRoles)
- **POST /:id/request-inspection** — requireRole(`acp_comercial`)
- **PATCH /:id/coordinate-inspection-date** — requireRole(`jefe_tecnico`, `jefe_servicio_tecnico`)
- **PATCH /:id/review-inspection-date** — requireRole(`jefe_tecnico`, `jefe_servicio_tecnico`)
- **PATCH /:id/site-inspection** — requireRole(`tecnico`, `jefe_tecnico`, `jefe_servicio_tecnico`)
- **PATCH /:id/installation-workflow** — requireRole(deliveryRoles)
- **PATCH /:id/checklist** — requireRole(creatorRoles)

Roles:
- managerRoles: `acp_comercial`, `gerencia`, `gerencia_general`, `jefe_comercial`
- creatorRoles: `comercial` + managerRoles
- viewerRoles: creatorRoles + `jefe_tecnico`, `jefe_servicio_tecnico`, `tecnico`, `jefe_operaciones`

## 3. Flujo principal

1. Comercial crea orden de compra de equipo
2. ACP gestiona disponibilidad con proveedor
3. Se sube proforma y proveedor responde
4. ACP firma proforma y solicita inspección técnica
5. Técnico realiza inspección en sitio
6. Se coordinan fechas de entrega
7. Operaciones marca llegada del equipo
8. Se completa la entrega e instalación

## 4. Validaciones
- `purchaseEvents.js`: SSE con token en query param
- `equipmentPurchases.service.js` (169KB) — muy extenso

## 5. Base de datos
- No verificado en DB

## 6. Relaciones
- `private-purchases`: flujo paralelo para clientes con contrato privado
- `inventario`: equipos recibidos se registran en inventario
- `delivery-requests`: solicitudes de fechas de entrega
- `servicio`: inspección técnica ejecutada por técnicos del módulo servicio

## 7. Frontend asociado
- `/dashboard/comercial/equipment-purchases` → `EquipmentPurchasesPage`
- `/dashboard/comercial/acp-compras` → `ACPEquipmentPurchasesPage`
- `/dashboard/purchases/workspace` → `PurchasesWorkspace`

## 8. Riesgos detectados
- `equipmentPurchases.service.js` (169KB) — extremadamente grande
- SSE con token en query param — misma vulnerabilidad que private-purchases
- `__tests__` presente

## 9. Notas técnicas
- Módulo paralelo a `private-purchases` — compras públicas vs. privadas
