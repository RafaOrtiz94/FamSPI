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

**Este backend está VIGENTE y activo. Sirve por igual al frontend nuevo (producción) y a las páginas viejas huérfanas (no enrutadas).** Ver `.claude/skills/modulo-compras-comercial/SKILL.md` para el mapa completo legacy→producción.

- **Producción (ruta real montada):** `/dashboard/purchases/workspace` (query `?tab=public`) → `spi_front/src/modules/shared/purchases-workspace/PurchasesWorkspace.jsx`. Este workspace llama `core/api/equipmentPurchasesApi.js`, que pega contra los mismos endpoints listados en la sección 2 de este documento — no hay backend nuevo.
- **Legacy (rutas redirigidas, código huérfano):** `/dashboard/comercial/equipment-purchases` y `/dashboard/comercial/acp-compras` en `AppRoutes.jsx` ya NO renderizan `EquipmentPurchasesPage`/`ACPEquipmentPurchasesPage` — ambas rutas renderizan `<LegacyPublicPurchaseRedirect />`, que hace `<Navigate>` inmediato a `/dashboard/purchases/workspace?tab=public...`. Los archivos `spi_front/src/modules/comercial/pages/EquipmentPurchases.jsx` y `ACPEquipmentPurchases.jsx` (y el componente que ambos usan, `EquipmentPurchaseWidget.jsx`) siguen en el repo pero **no están importados por ningún router activo** — son código muerto que igual pega a este mismo backend si alguna vez se vuelve a montar. No confundir "sigue compilando y pegando a la API real" con "está en producción": nadie navega a esa UI.

## 8. Riesgos detectados
- `equipmentPurchases.service.js` (169KB) — extremadamente grande
- SSE con token en query param — misma vulnerabilidad que private-purchases
- `__tests__` presente

## 9. Notas técnicas
- Módulo paralelo a `private-purchases` — compras públicas vs. privadas
- El backend NO tiene versión legacy/vigente separada: es un único set de endpoints vigente. Lo que migró a legacy fue solo el frontend (páginas comerciales viejas → workspace unificado). No existe un módulo backend "purchases-workspace" ni equivalente — el workspace unificado consume literalmente estas mismas rutas.
