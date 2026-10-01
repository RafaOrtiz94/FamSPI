# Handoff IA-1 — Fase 0 Auth y Attendance

Fecha: 2026-07-07

## Alcance ejecutado

Se aplicaron cambios de observabilidad de bajo riesgo en backend, sin alterar contratos `{ ok: true|false }` ni flujos funcionales:

- `backend/src/middlewares/auth.js`
  - Se agregó `buildAuthRequestMeta(req)`.
  - Los rechazos por falta de token, token inválido/expirado y claims inválidos ahora registran `method`, `path`, `appPath`, `ip`, `userAgent` y `referer`.

- `backend/src/modules/auth/session.repository.js`
  - `updateSessionRefreshToken` ahora hace `RETURNING id`.
  - Se registra log exitoso de rotación de refresh token con `sessionId` y fragmentos de token.

- `backend/src/modules/auth/auth.controller.js`
  - Se agregó `buildAuthRequestMeta(req)`.
  - `refreshToken` ya registra contexto estructurado cuando la solicitud llega sin refresh token.
  - `refreshToken` ya registra contexto estructurado cuando el token no coincide con una sesión activa.

- `backend/src/modules/attendance/attendance.controller.js`
  - Se agregó `buildAttendanceRequestMeta(...)`.
  - `resolveRequiredLocation(...)` ahora registra contexto estructurado en rechazos por:
    - falta de ubicación
    - precisión GPS insuficiente
  - `enforceNoActiveTimeOffForMarking(...)` ahora registra log cuando una marcación es bloqueada por permiso/vacaciones activos.

## Validación ejecutada

Se validó sintaxis con `node -c` en:

- `backend/src/middlewares/auth.js`
- `backend/src/modules/auth/session.repository.js`
- `backend/src/modules/auth/auth.controller.js`
- `backend/src/modules/attendance/attendance.controller.js`

Todas las validaciones pasaron.

## Observación importante

`backend/src/modules/auth/auth.controller.js` todavía conserva el `logger.warn(...)` legado dentro del `catch` de `refreshToken` con texto mojibake (`invÃ¡lido`).

Estado:

- no rompe ejecución
- no afecta contrato
- quedó pendiente de limpieza puntual por dificultad de parcheo sobre esa línea específica en este turno

## Riesgo controlado

`backend/src/modules/attendance/attendance.controller.js` ya tenía múltiples cambios previos en el worktree. En esta fase solo se añadió observabilidad en puntos de rechazo; no se cambió la respuesta HTTP ni la lógica de negocio de esas rutas.
