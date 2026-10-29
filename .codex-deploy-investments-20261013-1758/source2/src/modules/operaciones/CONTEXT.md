# CONTEXT.md — operaciones

## 1. Descripción
Módulo de operaciones. Contiene una única ruta para que el rol de operaciones complete una solicitud. Está implementado como alias/wrapper del controller de `requests`. Posiblemente legado o en desarrollo.

## 2. Endpoints

Prefijo: No determinado en registerRoutes.js (puede no estar montado globalmente)

- **POST /:id/complete** — `completeRequest` (delegado a `requests.controller.js`) — verifyToken, `isOperaciones`

## 3. Flujo principal

1. Operaciones completa una solicitud en curso via `POST /:id/complete`

## 4. Validaciones
- `isOperaciones`: middleware de `auth.middleware.js` del módulo `auth` (distinto de `requireRole` de `roles.js`)
- Depende de `verifyToken` de `auth.middleware.js` (puede ser distinto del de `auth.js`)

## 5. Base de datos
- No verificado en DB

## 6. Relaciones
- `requests`: reutiliza directamente el controller de requests
- Acoplamiento directo con módulo requests — cualquier cambio en requests afecta este módulo

## 7. Frontend asociado
- No verificado en frontend

## 8. Riesgos detectados
- **Alto**: importa desde `../auth/auth.middleware` que puede no existir o ser distinto del middleware global
- Acoplamiento directo entre módulos (importa controller de otro módulo directamente)
- No verificado si está montado en registerRoutes.js

## 9. Notas técnicas
- `operaciones.routes.js` (11 líneas) — módulo mínimo, posiblemente legado
- El módulo de operaciones actual funciona a través del módulo `requests` con roles apropiados
