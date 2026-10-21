# CONTEXT.md — approvals

## 1. Descripción
Módulo de aprobaciones de solicitudes. Permite a jefes de servicio técnico listar solicitudes pendientes de aprobación, aprobarlas o rechazarlas. Actúa como intermediario genérico de flujo de aprobación.

## 2. Endpoints

- **GET /api/v1/approvals/pending**
  - Controller: `approvals.controller.js → listPending`
  - Service: `approvals.service.js`
  - Middleware: `verifyToken`, `requireRole`
  - Roles requeridos: `tecnico`, `gerencia`, `calidad`, `jefe_calidad`, `jefe_servicio_tecnico`, `jefe_tecnico`

- **POST /api/v1/approvals/:id/approve**
  - Controller: `approvals.controller.js → approve`
  - Service: `approvals.service.js`
  - Middleware: `verifyToken`, `requireRole`
  - Roles requeridos: `jefe_servicio_tecnico`, `jefe_tecnico`

- **POST /api/v1/approvals/:id/reject**
  - Controller: `approvals.controller.js → reject`
  - Service: `approvals.service.js`
  - Middleware: `verifyToken`, `requireRole`
  - Roles requeridos: `jefe_servicio_tecnico`, `jefe_tecnico`

## 3. Flujo principal

1. Un jefe consulta `/approvals/pending` para ver solicitudes pendientes
2. Evalúa la solicitud y toma una decisión
3. Llama a `/:id/approve` o `/:id/reject` con el ID de la solicitud
4. El service actualiza el estado de la solicitud en DB

## 4. Validaciones
- Solo jefes técnicos pueden aprobar/rechazar
- Respuestas forzadas sin caché (`Cache-Control: no-store`)
- Logs de debug activos en `development`

## 5. Base de datos

### Tablas usadas:
- No verificado en DB

### Campos relevantes:
- No verificado en DB

## 6. Relaciones
- Dependencias con otros módulos:
  - `servicio`: solicitudes de mantenimiento generadas por técnicos pasan por aquí
  - `notifications`: probable notificación al aprobar/rechazar (no verificado en código de este módulo)

## 7. Frontend asociado
- Rutas React: `/dashboard/servicio-tecnico/aprobaciones` → `ServicioAprobaciones`
- Servicio API: No verificado en frontend

## 8. Riesgos detectados
- El módulo es muy pequeño (controller: 1KB) — puede estar delegando lógica compleja a `approvals.service.js`
- No hay validación de existencia del ID antes de aprobar/rechazar (no verificado en service)

## 9. Notas técnicas
- `approvals.service.js` (11KB) contiene la lógica principal — revisar antes de extender
- Existe directorio `__tests__` — hay pruebas automatizadas
