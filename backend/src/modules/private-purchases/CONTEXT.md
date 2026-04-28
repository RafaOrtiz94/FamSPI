# CONTEXT.md — private-purchases

## 1. Descripción
Módulo de compras privadas (equipos para clientes finales). Cubre el flujo completo desde la creación hasta la entrega: oferta, firma, inspección, instalación, entrega, acta de entrega y auditoría. Incluye SSE (Server-Sent Events) para actualizaciones en tiempo real y una state machine con múltiples estados.

## 2. Endpoints (selección principal)

- **GET /api/v1/private-purchases/events** — SSE streaming — requireRole(viewerRoles)
- **POST /api/v1/private-purchases/** — `create`
- **GET /api/v1/private-purchases/** — `list`
- **GET /api/v1/private-purchases/mine** — `listMine`
- **GET /api/v1/private-purchases/by-role/:role** — `listByRole`
- **GET /api/v1/private-purchases/:id** — `getOne`
- **POST /api/v1/private-purchases/:id/transition** — `transitionState`
- **GET /api/v1/private-purchases/:id/transitions** — `getAllowedTransitions`
- **POST /api/v1/private-purchases/:id/offer** — `sendOffer`
- **POST /api/v1/private-purchases/:id/offer/signed** — `uploadSignedOffer`
- **POST /api/v1/private-purchases/:id/send-to-acp** — `forwardToAcp`
- **POST /api/v1/private-purchases/:id/start-business-case** — requireRole(`backoffice_comercial`, `acp_comercial`, `jefe_comercial`)
- **POST /api/v1/private-purchases/:id/provider-response** — `saveProviderResponse`
- **POST /api/v1/private-purchases/:id/submit-contract** — `uploadContract`
- **POST /api/v1/private-purchases/:id/inspection-request** — `saveInspectionRequest`
- **PATCH /api/v1/private-purchases/:id/coordinate-inspection-date** — `coordinateInspectionDate`
- **PATCH /api/v1/private-purchases/:id/review-inspection-date** — requireRole(`jefe_tecnico`, `jefe_servicio_tecnico`)
- **PATCH /api/v1/private-purchases/:id/site-inspection** — requireRole(`tecnico`, `jefe_tecnico`, `jefe_servicio_tecnico`)
- **PATCH /api/v1/private-purchases/:id/installation-workflow** — múltiples roles técnicos/comerciales/logística
- **POST /api/v1/private-purchases/:id/delivery-guides** — `uploadDeliveryGuides`
- **POST /api/v1/private-purchases/:id/request-delivery-dates**
- **POST /api/v1/private-purchases/:id/complete-delivery** — `completeDelivery`
- **POST /api/v1/private-purchases/:id/delivery-act** — `uploadDeliveryAct`
- **POST /api/v1/private-purchases/:id/delivery-act/finalize** — `finalizeDeliveryAct`
- **GET /api/v1/private-purchases/:id/timeline** — auditoría
- **GET /api/v1/private-purchases/stats/:role** — `getStats`

## 3. Flujo principal

1. Comercial crea la compra privada
2. Se envía oferta al proveedor
3. Proveedor responde → se sube contrato firmado
4. ACP solicita inspección técnica
5. Técnico realiza inspección en sitio
6. Se coordina instalación y entrega del equipo
7. Se firma acta de entrega digital
8. Flujo cerrado — entrega completada

## 4. Validaciones
- `privatePurchaseStateMachine.js` (40KB): state machine completa con transiciones válidas
- `privatePurchaseStates.constants.js` (9KB): constantes de estados
- Roles diferenciados por etapa del flujo
- SSE con token en query param como workaround de autenticación

## 5. Base de datos
- No verificado en DB

## 6. Relaciones
- `business-case`: `start-business-case` conecta con el módulo de BC
- `servicio`: inspección e instalación involucran técnicos
- `delivery-requests`: gestión de fechas de entrega
- `notifications`: notificaciones en cada transición de estado
- `signature`: acta de entrega puede requerir firma digital

## 7. Frontend asociado
- `/dashboard/backoffice/private-purchases` → `PrivatePurchasesPage`
- `/dashboard/operaciones/private-purchases` → `OperacionesPrivatePurchases`
- `/dashboard/logistica/private-purchases` → `LogisticaPrivatePurchases`
- `/dashboard/servicio-tecnico/compras-privadas` → `TecnicoPrivatePurchases`
- `/dashboard/servicio-tecnico/entregas-privadas` → `ServicioPrivatePurchaseDeliveries`
- `/dashboard/purchases/workspace` → `PurchasesWorkspace`

## 8. Riesgos detectados
- `privatePurchases.service.js` (211KB) — el segundo archivo más grande del repositorio
- SSE con token en query param es un workaround — considerar seguridad
- State machine muy compleja — cambios requieren prueba exhaustiva

## 9. Notas técnicas
- `AGENTS.md` presente en el módulo
- `privatePurchaseEvents.js` gestiona SSE
- Módulo transversal: involucra comercial, técnico, operaciones, logística
