# CONTEXT.md — offboarding

## 1. Descripción
Módulo de offboarding (baja de colaboradores). Gestiona el proceso estructurado de desvinculación de un empleado, incluyendo checklist de tareas, liquidación y cierre formal. Acceso exclusivo a roles de RRHH, finanzas y admin.

## 2. Endpoints

Prefijo: `/api/v1/offboarding`

Roles requeridos en todo el módulo: `talento_humano`, `jefe_talento_humano`, `jefe_financiero`, `jefe_finanzas`, `jefe_ti`, `gerencia_general`, `admin`

- **GET /api/v1/offboarding/:userId/workspace** — `getWorkspace`
- **PATCH /api/v1/offboarding/:userId/tasks/:taskKey** — `updateTask`
- **POST /api/v1/offboarding/:userId/start** — `startOffboarding`
- **POST /api/v1/offboarding/:userId/liquidation** — `runLiquidation`
- **POST /api/v1/offboarding/:userId/close** — `closeOffboarding`

## 3. Flujo principal

1. TH inicia el offboarding de un usuario (`/start`)
2. Se asignan tareas al checklist de baja (devolución de equipos, accesos, etc.)
3. Cada área marca sus tareas como completadas (`/tasks/:taskKey`)
4. Finanzas ejecuta la liquidación (`/liquidation`)
5. TH cierra el proceso formalmente (`/close`)

## 4. Validaciones
- Acceso restringido a roles administrativos y financieros
- `verifyToken` + `requireRole` a nivel de router completo

## 5. Base de datos
- No verificado en DB

## 6. Relaciones
- `users`: el userId referencia un usuario del sistema
- `talento_humano`: depende del módulo de empleados
- `notifications`: probable notificación al usuario dado de baja

## 7. Frontend asociado
- No verificado en frontend (no hay ruta explícita en AppRoutes.jsx)

## 8. Riesgos detectados
- `offboarding.service.js` (36KB) — grande para el número de endpoints expuestos

## 9. Notas técnicas
- `runLiquidation` sugiere integración con cálculos de finanzas para liquidación laboral
