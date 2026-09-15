# CONTEXT.md — technical-applications

## 1. Descripción
Módulo de aplicaciones técnicas disponibles. Expone un catálogo de aplicaciones de servicio técnico que pueden ser asignadas o consultadas. Módulo de solo lectura con un único endpoint.

## 2. Endpoints

Prefijo: No determinado en registerRoutes.js (módulo puede no estar montado)

- **GET /available** — `listAvailable` — requireRole(`servicio_tecnico`, `tecnico`, `jefe_servicio_tecnico`, `gerencia`, `administrador`)

## 3. Flujo principal

1. Técnico o jefe consulta las aplicaciones técnicas disponibles
2. Información usada para asignación de trabajos o equipos

## 4. Validaciones
- Sin `verifyToken` explícito en el router
- No verificado si está montado en `registerRoutes.js`

## 5. Base de datos
- No verificado en DB

## 6. Relaciones
- `servicio`: aplicaciones técnicas usadas en procesos de servicio
- `business-case`: puede referenciar aplicaciones técnicas

## 7. Frontend asociado
- No verificado en frontend

## 8. Riesgos detectados
- Módulo puede NO estar montado en el router principal — no verificado en registerRoutes.js
- Sin `verifyToken` explícito

## 9. Notas técnicas
- `technicalApplications.controller.js` (1KB) — muy pequeño
- Solo 1 endpoint activo — módulo posiblemente en desarrollo inicial
