# CONTEXT.md — vacaciones

## 1. Descripción
Módulo de gestión de vacaciones de colaboradores. Cubre el ciclo completo: solicitud, aprobación/rechazo, cancelación, validación de saldo disponible y resumen de vacaciones.

## 2. Endpoints

- **GET /api/v1/vacaciones/legal-verification/:token** — `verifyLegalToken` — pública
- **POST /api/v1/vacaciones/** — `create` — verifyToken
- **GET /api/v1/vacaciones/** — `list` — verifyToken
- **PATCH /api/v1/vacaciones/:id/status** — `updateStatus` — verifyToken
- **POST /api/v1/vacaciones/:id/cancel** — `cancel` — verifyToken
- **PATCH /api/v1/vacaciones/:id/dates** — `updateDates` — verifyToken
- **POST /api/v1/vacaciones/:id/cancel/review** — `reviewCancel` — verifyToken
- **GET /api/v1/vacaciones/summary/data** — `getSummary` — verifyToken
- **GET /api/v1/vacaciones/validate-balance** — `validateBalance` — verifyToken

## 3. Flujo principal

1. Colaborador crea solicitud de vacaciones
2. Jefe/TH aprueba o rechaza via `PATCH /:id/status`
3. Si necesita modificar fechas: `PATCH /:id/dates`
4. Si se cancela: flujo `cancel` + `reviewCancel`
5. Sistema valida saldo de días disponibles antes de aprobar

## 4. Validaciones
- `validateBalance`: verifica saldo antes de crear solicitud
- Ruta pública de verificación legal por token (firma)

## 5. Base de datos
- No verificado en DB

## 6. Relaciones
- `signature`: firma digital en aprobaciones
- `notifications`: notificación al jefe
- `permisos`: módulo hermano con flujo similar

## 7. Frontend asociado
- No verificado en frontend (no hay ruta explícita en AppRoutes.jsx para vacaciones independiente)
- Probable integración dentro de `PermisosPage` o `CollaboratorCommandCenter`

## 8. Riesgos detectados
- `vacaciones.service.js` (52KB) — grande, revisar antes de extender
- Sin control de roles explícito por endpoint (solo verifyToken general)

## 9. Notas técnicas
- Patrón similar a `permisos` — posible refactorización compartida
