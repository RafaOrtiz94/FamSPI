# CONTEXT.md — dashboard

## 1. Descripción
Módulo de dashboard comercial. Expone métricas y resúmenes para el panel de control del área comercial.

## 2. Endpoints

- **GET /api/v1/dashboard/comercial/summary** — `getCommercialSummary` — verifyToken, requireRole(COMMERCIAL_DASHBOARD_ROLES)
  - Roles: `comercial`, `jefe_comercial`, `backoffice_comercial`, `acp_comercial`, `analista_comercial`, `gerencia`

## 3. Flujo principal

1. Usuario comercial accede al dashboard
2. Frontend llama a `GET /dashboard/comercial/summary`
3. Service agrega métricas comerciales y retorna resumen

## 4. Validaciones
- asyncHandler wrapping para manejo de errores async

## 5. Base de datos
- No verificado en DB

## 6. Relaciones
- `requests`: probablemente agrega datos de solicitudes
- `clients`: probablemente agrega datos de clientes
- `business-case`: métricas de business cases

## 7. Frontend asociado
- `/dashboard/comercial` → `DashboardComercial`

## 8. Riesgos detectados
- Módulo muy pequeño (1 endpoint) — puede crecer significativamente

## 9. Notas técnicas
- `dashboard.service.js` (12KB) contiene la lógica de agregación
