# skill: auth

## Proposito
Resolver OAuth/JWT/sesiones y 401-403 de capa de autenticacion.

## Alcance exacto
- `backend/src/modules/auth/auth.controller.js`
- `backend/src/modules/auth/auth.routes.js`
- `backend/src/modules/auth/session.repository.js`
- `backend/src/middlewares/auth.js`
- `backend/src/config/oauth.js`

## Activar cuando
- Falla login Google callback.
- Falla refresh token/sesion.
- 401 por `verifyToken`.

## No usar cuando
- Es RBAC de roles/allowedRoles (usar `routing-rbac-skill.md`).
- Es bug visual de login (usar `frontend-skill.md`).

## Maximo de archivos por tarea
- 3 archivos.

## Verificacion minima
```bash
cd backend && npm run lint src/modules/auth/ src/middlewares/auth.js
```

## Stop condition
- Si requiere tocar auth + roles + rutas frontend en una misma tarea, dividir.

## Handoff
- RBAC/rutas protegidas -> `.agents/skills/routing-rbac-skill.md`
