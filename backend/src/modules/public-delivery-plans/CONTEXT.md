# CONTEXT.md — public-delivery-plans

## 1. Descripción
Módulo de planes de entrega públicos (planificación de despacho). Permite crear borradores de planes, agregar líneas de entrega y transicionar estados. Acceso restringido a roles de planificación comercial y operaciones.

## 2. Endpoints

Prefijo: `/api/v1/public-delivery-plans`

Roles requeridos en todo el módulo: `acp_comercial`, `jefe_comercial`, `gerencia`, `gerencia_general`, `jefe_operaciones`

- **GET /api/v1/public-delivery-plans/** — `list` — verifyToken, requireRole(PLAN_ANALYST_ROLES)
- **POST /api/v1/public-delivery-plans/** — `createDraft` — verifyToken, requireRole(PLAN_ANALYST_ROLES)
- **POST /api/v1/public-delivery-plans/:id/lines** — `addLine` — verifyToken, requireRole(PLAN_ANALYST_ROLES)
- **POST /api/v1/public-delivery-plans/:id/status** — `transitionStatus` — verifyToken, requireRole(PLAN_ANALYST_ROLES)

## 3. Flujo principal

1. ACP o jefe crea borrador de plan de entrega
2. Agrega líneas de entrega (equipos, fechas, clientes)
3. Transiciona el estado del plan (borrador → aprobado → ejecutado)

## 4. Validaciones
- Solo roles de planificación tienen acceso

## 5. Base de datos
- No verificado en DB

## 6. Relaciones
- `delivery-ceilings`: plan de entregas respeta los topes configurados
- `equipment-purchases`/`private-purchases`: los planes cubren las compras en curso

## 7. Frontend asociado
- No verificado en frontend (probable integración en workspace de compras)

## 8. Riesgos detectados
- Módulo pequeño (4 endpoints) — funcionalidad puede estar incompleta
- `publicDeliveryPlans.service.js` (14KB) — proporcional

## 9. Notas técnicas
- Diferente de `delivery-requests` (solicitudes individuales) — este módulo gestiona planes agregados
