# CONTEXT.md — delivery-requests

## 1. Descripción
Módulo de solicitudes de entrega para equipos. Permite crear solicitudes de fechas de entrega y confirmar entregas realizadas. Módulo pequeño, actúa como sub-flujo de compras.

## 2. Endpoints

Prefijo: `/api/v1/delivery-requests`

- **POST /api/v1/delivery-requests/** — `createDeliveryRequest` — verifyToken, requireRole(REQUEST_CREATOR_ROLES)
  - Roles: `comercial`, `backoffice_comercial`, `acp_comercial`, `gerencia`, `gerencia_general`, `jefe_comercial`
- **POST /api/v1/delivery-requests/:id/confirm-delivery** — `confirmDeliveryRequest` — verifyToken, requireRole(DELIVERY_CONFIRM_ROLES)
  - Roles: managerRoles + `jefe_operaciones`, `operaciones`, `jefe_logistica`, `jefe_tecnico`, `jefe_servicio_tecnico`, `tecnico`

## 3. Flujo principal

1. Comercial o ACP crea solicitud de fecha de entrega
2. Operaciones/Técnico confirma la entrega realizada

## 4. Validaciones
- Dos grupos de roles: creadores (comercial) y confirmadores (operaciones/técnicos)

## 5. Base de datos
- No verificado en DB

## 6. Relaciones
- `equipment-purchases`: flujo principal del que este módulo es sub-componente
- `private-purchases`: similar función en el flujo de compras privadas

## 7. Frontend asociado
- No verificado en frontend (integrado dentro de los workspaces de compras)

## 8. Riesgos detectados
- Módulo muy pequeño (2 endpoints) — posible expansión futura
- `__tests__` presente

## 9. Notas técnicas
- `deliveryRequests.service.js` (20KB) — mayor complejidad de la esperada para 2 endpoints
